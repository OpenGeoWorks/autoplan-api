import { Readable } from 'stream';
import { Types } from 'mongoose';
import env from '@config/env';
import { RepoOptions } from '@db/types';
import { ApiError } from '@utils/api-error';
import logger from '@utils/logger';
import { CoordinateProps } from '@modules/traverse/traverse.interface';
import { backComputation, forwardComputation, traverseComputation } from '@modules/traverse/traverse.service';
import { differentialLeveling } from '@modules/leveling/leveling.service';
import projectRepository from '@modules/project/project.repository';
import Plan from './plan.model';
import planRepository from './plan.repository';
import planPoints, { PREVIEW_LIMIT } from './plan-points.repository';
import { CoordinateLimitError, CoordinateParseError, streamCoordinates } from './coordinate-stream';
import { ColumnMapping } from './coordinate-parser';
import { PointKind, stagingKindFor } from './plan.interface';
import planJobs, { PlanJob } from './plan-job';
import objectStorage from '@utils/object-storage';
import uploadSpool from '@utils/upload-spool';
import { randomUUID } from 'crypto';
import os from 'os';
import { computeEmbellishmentsFromExtent, computePlanEmbellishments, computeRouteEmbellishments, PlanEmbellishments } from './plan.embellishments';
import {
    BeaconType,
    CreatePlanInput,
    EditPlanInput,
    ElevationProps,
    IPlan,
    ImportComputationInput,
    LayoutBoundary,
    LayoutDataInput,
    LayoutMode,
    LayoutParameters,
    LongitudinalProfileParameters,
    PageOrientation,
    PageSize,
    ParcelProps,
    PlanOrigin,
    PlanType,
    RouteParameters,
    TopographicBoundary,
    TopographicSetting,
} from './plan.interface';

const defaultTopographicSetting = (): TopographicSetting => ({
    show_spot_heights: true,
    point_label_scale: 0.2,
    show_contours: true,
    contour_interval: 0.1,
    major_contour: 0.5,
    minimum_distance: 0.1,
    show_contours_labels: true,
    contour_label_scale: 0.5,
    show_boundary: true,
    boundary_label_scale: 0.2,
    tin: false,
    grid: true,
    show_mesh: false,
    show_tin_mesh: false,
    show_grid: false,
});

const defaultLongitudinalProfileParameters = (): LongitudinalProfileParameters => ({
    horizontal_scale: 1.0,
    vertical_scale: 10,
    station_interval: 10,
    elevation_interval: 1.0,
});

const defaultRouteParameters = (): RouteParameters => ({
    right_of_way_width: 30,
    show_plan_view: true,
    show_chainage_labels: true,
});

const defaultLayoutParameters = (): LayoutParameters => ({
    plot: { frontage: 15, depth: 30, min_area: 400, remainder_strategy: 'add_to_last' },
    roads: { major_width: 15, collector_width: 12, access_width: 9, corner_radius: 6, major_road_name: '' },
    blocks: { double_loaded: true, max_length: 180, orientation: 'auto' },
    reserves: { open_space_percent: 10, commercial_along_major: true, facilities: [] },
    numbering: { scheme: 'block_plot', block_labels: 'alphabetic', plot_start: 1 },
});

/**
 * Whether this plan's sizes are still driven from the drawing extent.
 *
 * Map plans with `auto_scale_sizes` on (the default) are plotted at their
 * declared scale and take their text heights from the drawing service's
 * printed-millimetre table, so recomputing these fields would overwrite a
 * user's manual sizes with numbers nothing reads. Route sheets are fitted to
 * the page and have no scale to size from, so they always keep the
 * extent-derived values.
 */
const usesExtentSizing = (plan: IPlan): boolean =>
    plan.type === PlanType.ROUTE || plan.auto_scale_sizes === false;

const applySizes = (
    plan: IPlan,
    update: Partial<IPlan>,
    embellishments: PlanEmbellishments | null,
): void => {
    if (!embellishments || !usesExtentSizing(plan)) return;
    update.font_size = embellishments.font_size;
    update.beacon_size = embellishments.beacon_size;
    update.label_size = embellishments.label_size;
    update.footer_size = embellishments.footer_size;
};

const requirePlan = (plan: IPlan | null): IPlan => {
    if (!plan) throw ApiError.notFound('Plan not found');
    return plan;
};

const requireType = (plan: IPlan, type: PlanType, label: string): void => {
    if (plan.type !== type) throw ApiError.badRequest(`Plan is not a ${label} plan`);
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export const createPlan = async (data: CreatePlanInput, options?: RepoOptions): Promise<IPlan> => {
    const project = await projectRepository.getProjectById(data.project as string, options);
    if (!project) throw ApiError.notFound('Project not found');

    const planData: Omit<IPlan, 'id' | 'created_at' | 'updated_at'> = {
        user: project.user,
        project: project.id,
        name: data.name,
        type: data.type,
        address: project.location?.address,
        local_govt: project.location?.city,
        state: project.location?.state,
        surveyor_name: project.surveyor?.name,
        font: 'Arial',
        // The four size controls are printed millimetres on the sheet, and
        // each governs one group of elements: font_size the title block,
        // label_size the map annotation, footer_size the footer text,
        // beacon_size the symbols. These are the drawing engine's designed
        // sizes, so a plan nobody has restyled is drawn as designed.
        //
        // They were ground metres before Task 8 (and font_size was 12, which
        // now reads as a 12 mm title). Route sheets are fitted to the page
        // rather than plotted at a scale, so computePlanEmbellishments still
        // overwrites these for them once coordinates arrive.
        font_size: 5,
        origin: PlanOrigin.UTM_ZONE_31,
        scale: 1000,
        beacon_type: BeaconType.BOX,
        beacon_size: 1.6,
        label_size: 2.5,
        page_size: PageSize.A4,
        page_orientation: PageOrientation.PORTRAIT,
        title: 'Untitled Plan',
        footers: [],
        footer_size: 2.5,
        computation_only: data.computation_only,
    };

    if (planData.type === PlanType.TOPOGRAPHIC) {
        planData.topographic_setting = defaultTopographicSetting();
    }

    if (planData.type === PlanType.ROUTE) {
        planData.longitudinal_profile_parameters = defaultLongitudinalProfileParameters();
        planData.route_parameters = defaultRouteParameters();
    }

    if (planData.type === PlanType.LAYOUT) {
        planData.layout_parameters = defaultLayoutParameters();
        planData.layout_mode = LayoutMode.AUTO;
    }

    return planRepository.createPlan(planData);
};

export const fetchPlan = async (id: string, options?: RepoOptions): Promise<IPlan> => {
    return requirePlan(await planRepository.getPlanById(id, options));
};

export const listPlans = async (projectId: string, options?: RepoOptions): Promise<IPlan[]> => {
    return planRepository.listPlans(projectId, options);
};

export const editPlan = async (id: string, data: EditPlanInput, options?: RepoOptions): Promise<IPlan> => {
    return requirePlan(await planRepository.editPlan(id, data, options));
};

export const deletePlan = async (id: string, options?: RepoOptions): Promise<void> => {
    // Deliberately leaves the point store alone. This is a soft delete -- the
    // document is flagged, not removed -- so the survey has to survive it or
    // a restored plan would come back empty. Points are only ever removed
    // when a plan is genuinely gone.
    requirePlan(await planRepository.deletePlan(id, options));
};

// ---------------------------------------------------------------------------
// Survey data editing
// ---------------------------------------------------------------------------

const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const item of items) {
        if (!seen.has(item.id)) {
            result.push(item);
            seen.add(item.id);
        }
    }
    return result;
};

/**
 * Whether a plan's coordinates came from a file rather than the table.
 *
 * The distinction matters because the two have different owners. Typed
 * coordinates live in the plan document and the table is where they are
 * edited. Uploaded ones live in the point store, the file is the record of
 * them, and the table only ever shows the first few hundred -- so "save the
 * table" is not an edit, it is a truncation.
 *
 * Derived from point_source rather than kept as a second flag: it is set by
 * the upload and cleared by a manual edit, so it cannot disagree with itself,
 * and plans uploaded before this existed are already correct.
 */
export const isUploaded = (
    plan: Pick<IPlan, 'point_source'>,
    kind: PointKind = 'coordinates',
): boolean =>
    Boolean(plan.point_source?.uploaded_at)
    // Records written before point_source carried a kind were all coordinates.
    && (plan.point_source?.kind ?? 'coordinates') === kind;

export const editCoordinates = async (
    id: string,
    coordinates: CoordinateProps[],
    options?: RepoOptions,
): Promise<IPlan> => {
    const plan = requirePlan(
        await planRepository.getPlanById(id, {
            filter: options?.filter,
            projection: {
                type: 1,
                point_source: 1,
                topographic_boundary: 1,
                topographic_setting: 1,
                elevations: 1,
                longitudinal_profile_parameters: 1,
                route_parameters: 1,
            },
        }),
    );

    // An uploaded survey is not editable row by row. The table shows a preview
    // of it, so writing that back would replace the survey with its own first
    // few hundred points -- and even where the whole thing fits in the
    // preview, the file is the record of what was surveyed. Changing it means
    // uploading a different file.
    if (isUploaded(plan)) {
        const storedCount = await planPoints.countPoints(id, 'coordinates');
        throw ApiError.badRequest(
            `These ${storedCount.toLocaleString()} coordinates came from ` +
            `${plan.point_source?.file_name ?? 'an uploaded file'}. Upload a replacement ` +
            'file to change them.',
        );
    }

    if (coordinates.length > env.MAX_SURVEY_POINTS) {
        throw new ApiError(
            413,
            `This plan carries ${coordinates.length.toLocaleString()} coordinates, over the ` +
            `${env.MAX_SURVEY_POINTS.toLocaleString()} maximum this service accepts.`,
        );
    }

    const updatedCoordinates = dedupeById(coordinates);
    // Typed coordinates: the document owns them now, so any record of a file
    // they once came from is cleared rather than left to contradict it.
    const update: Partial<IPlan> = {
        coordinates: updatedCoordinates,
        // null, not undefined: mongoose strips undefined out of $set, so the
        // field would have been left standing while the code read as if it
        // had been cleared.
        point_source: null as never,
    };
    let recordSizeAfterWrite = false;

    // A hand-edited set replaces the stored series outright.
    await planPoints.replacePoints(id, 'coordinates', updatedCoordinates);
    update.point_count = updatedCoordinates.length;
    recordSizeAfterWrite = true;

    if (plan.type === PlanType.ROUTE) {
        // Route sheets are sized by their drawn views, not a boundary
        applySizes(plan, update, computeRouteEmbellishments({
            elevations: plan.elevations,
            coordinates: updatedCoordinates,
            longitudinal_profile_parameters: plan.longitudinal_profile_parameters,
            route_parameters: plan.route_parameters,
            page_size: plan.page_size,
        }));
        return requirePlan(await planRepository.editPlan(id, update, options));
    }

    // Element sizes derive from the full extent of the drawing, so include
    // the topographic boundary when there is one.
    const embellishmentCoordinates = [...updatedCoordinates];
    if (plan.type === PlanType.TOPOGRAPHIC && plan.topographic_boundary?.coordinates) {
        embellishmentCoordinates.push(...plan.topographic_boundary.coordinates);
    }

    if (embellishmentCoordinates.length > 0 && usesExtentSizing(plan)) {
        const embellishments = computePlanEmbellishments(embellishmentCoordinates, plan.page_size);
        applySizes(plan, update, embellishments);

        if (plan.type === PlanType.TOPOGRAPHIC && plan.topographic_setting) {
            plan.topographic_setting.point_label_scale = embellishments.point_label_scale;
            plan.topographic_setting.contour_label_scale = embellishments.contour_label_scale;
            update.topographic_setting = plan.topographic_setting;
        }
    }

    const saved = requirePlan(await planRepository.editPlan(id, update, options));
    if (recordSizeAfterWrite) await recordPlanSize(id);
    return saved;
};

export const editElevations = async (
    id: string,
    elevations: ElevationProps[],
    options?: RepoOptions,
): Promise<IPlan> => {
    const plan = requirePlan(
        await planRepository.getPlanById(id, {
            filter: options?.filter,
            projection: { type: 1, coordinates: 1, longitudinal_profile_parameters: 1, route_parameters: 1 },
        }),
    );
    requireType(plan, PlanType.ROUTE, 'route survey');

    const updatedElevations = dedupeById(elevations);
    const update: Partial<IPlan> = { elevations: updatedElevations };
    applySizes(plan, update, computeRouteEmbellishments({
        elevations: updatedElevations,
        coordinates: plan.coordinates,
        longitudinal_profile_parameters: plan.longitudinal_profile_parameters,
        route_parameters: plan.route_parameters,
        page_size: plan.page_size,
    }));

    return requirePlan(await planRepository.editPlan(id, update, options));
};

export const editParcels = async (id: string, parcels: ParcelProps[], options?: RepoOptions): Promise<IPlan> => {
    return requirePlan(await planRepository.editPlan(id, { parcels }, options));
};

export const editTraverseComputation = async (
    id: string,
    data: IPlan['traverse_computation_data'],
    options?: RepoOptions,
): Promise<IPlan> => {
    return requirePlan(await planRepository.editPlan(id, { traverse_computation_data: data }, options));
};

export const editForwardComputation = async (
    id: string,
    data: IPlan['forward_computation_data'],
    options?: RepoOptions,
): Promise<IPlan> => {
    return requirePlan(await planRepository.editPlan(id, { forward_computation_data: data }, options));
};

export const editBackComputation = async (
    id: string,
    data: IPlan['back_computation_data'],
    options?: RepoOptions,
): Promise<IPlan> => {
    return requirePlan(await planRepository.editPlan(id, { back_computation_data: data }, options));
};

export const editDifferentialLeveling = async (
    id: string,
    data: IPlan['differential_leveling_data'],
    options?: RepoOptions,
): Promise<IPlan> => {
    const plan = requirePlan(
        await planRepository.getPlanById(id, { filter: options?.filter, projection: { type: 1 } }),
    );
    requireType(plan, PlanType.ROUTE, 'route survey');

    return requirePlan(await planRepository.editPlan(id, { differential_leveling_data: data }, options));
};

export const editTopoBoundary = async (
    id: string,
    boundary: TopographicBoundary,
    options?: RepoOptions,
): Promise<IPlan> => {
    const plan = requirePlan(
        await planRepository.getPlanById(id, {
            filter: options?.filter,
            projection: { type: 1, coordinates: 1, topographic_setting: 1 },
        }),
    );
    requireType(plan, PlanType.TOPOGRAPHIC, 'topographic');

    if (boundary.coordinates.length > 0) {
        const uniqueIds = new Set(boundary.coordinates.map(point => point.id));
        if (uniqueIds.size < 3) {
            throw ApiError.badRequest('A boundary must have at least 3 unique points');
        }
    }

    // Close the boundary polygon when the caller has not
    const coords = boundary.coordinates;
    if (coords.length > 0 && coords[0].id !== coords[coords.length - 1].id) {
        coords.push(coords[0]);
    }

    const update: Partial<IPlan> = { topographic_boundary: boundary };

    if (usesExtentSizing(plan)) {
        const embellishments = computePlanEmbellishments(
            [...coords, ...(plan.coordinates || [])],
            plan.page_size,
        );
        applySizes(plan, update, embellishments);

        if (plan.topographic_setting) {
            plan.topographic_setting.point_label_scale = embellishments.point_label_scale;
            plan.topographic_setting.contour_label_scale = embellishments.contour_label_scale;
            update.topographic_setting = plan.topographic_setting;
        }
    }

    return requirePlan(await planRepository.editPlan(id, update, options));
};

export const editTopoSetting = async (
    id: string,
    setting: TopographicSetting,
    options?: RepoOptions,
): Promise<IPlan> => {
    const plan = requirePlan(
        await planRepository.getPlanById(id, { filter: options?.filter, projection: { type: 1 } }),
    );
    requireType(plan, PlanType.TOPOGRAPHIC, 'topographic');

    return requirePlan(await planRepository.editPlan(id, { topographic_setting: setting }, options));
};

export const editLongitudinalProfileParameters = async (
    id: string,
    params: LongitudinalProfileParameters,
    options?: RepoOptions,
): Promise<IPlan> => {
    const plan = requirePlan(
        await planRepository.getPlanById(id, {
            filter: options?.filter,
            projection: { type: 1, elevations: 1, coordinates: 1, route_parameters: 1 },
        }),
    );
    requireType(plan, PlanType.ROUTE, 'route');

    const update: Partial<IPlan> = { longitudinal_profile_parameters: params };
    applySizes(plan, update, computeRouteEmbellishments({
        elevations: plan.elevations,
        coordinates: plan.coordinates,
        longitudinal_profile_parameters: params,
        route_parameters: plan.route_parameters,
        page_size: plan.page_size,
    }));

    return requirePlan(await planRepository.editPlan(id, update, options));
};

export const editRouteParameters = async (
    id: string,
    params: RouteParameters,
    options?: RepoOptions,
): Promise<IPlan> => {
    const plan = requirePlan(
        await planRepository.getPlanById(id, {
            filter: options?.filter,
            projection: { type: 1, elevations: 1, coordinates: 1, longitudinal_profile_parameters: 1 },
        }),
    );
    requireType(plan, PlanType.ROUTE, 'route');

    const update: Partial<IPlan> = { route_parameters: params };
    applySizes(plan, update, computeRouteEmbellishments({
        elevations: plan.elevations,
        coordinates: plan.coordinates,
        longitudinal_profile_parameters: plan.longitudinal_profile_parameters,
        route_parameters: params,
        page_size: plan.page_size,
    }));

    return requirePlan(await planRepository.editPlan(id, update, options));
};

// ---------------------------------------------------------------------------
// Layout (estate subdivision) data editing
// ---------------------------------------------------------------------------

export const editLayoutBoundary = async (
    id: string,
    boundary: LayoutBoundary,
    options?: RepoOptions,
): Promise<IPlan> => {
    const plan = requirePlan(
        await planRepository.getPlanById(id, {
            filter: options?.filter,
            projection: { type: 1, coordinates: 1 },
        }),
    );
    requireType(plan, PlanType.LAYOUT, 'layout');

    const uniqueIds = new Set(boundary.coordinates.map(point => point.id));
    if (uniqueIds.size < 3) {
        throw ApiError.badRequest('A boundary must have at least 3 unique points');
    }

    // Close the boundary polygon when the caller has not
    const coords = boundary.coordinates;
    if (coords.length > 0 && coords[0].id !== coords[coords.length - 1].id) {
        coords.push(coords[0]);
    }

    const embellishments = computePlanEmbellishments([...coords, ...(plan.coordinates || [])]);

    const update: Partial<IPlan> = {
        layout_boundary: boundary,
        font_size: embellishments.font_size,
        beacon_size: embellishments.beacon_size,
        label_size: embellishments.label_size,
        footer_size: embellishments.footer_size,
    };

    return requirePlan(await planRepository.editPlan(id, update, options));
};

export const editLayoutParameters = async (
    id: string,
    params: LayoutParameters,
    mode?: LayoutMode,
    options?: RepoOptions,
): Promise<IPlan> => {
    const plan = requirePlan(
        await planRepository.getPlanById(id, { filter: options?.filter, projection: { type: 1 } }),
    );
    requireType(plan, PlanType.LAYOUT, 'layout');

    const update: Partial<IPlan> = { layout_parameters: params };
    if (mode) update.layout_mode = mode;

    return requirePlan(await planRepository.editPlan(id, update, options));
};

/**
 * Edit a layout's designed data (draw mode): the plot corner coordinate
 * register, the plots (corner ids per plot), and optional roads. Every plot
 * corner and road centerline id must resolve to a coordinate in the register
 * or the layout boundary.
 */
export const editLayoutData = async (id: string, data: LayoutDataInput, options?: RepoOptions): Promise<IPlan> => {
    const plan = requirePlan(
        await planRepository.getPlanById(id, {
            filter: options?.filter,
            projection: { type: 1, coordinates: 1, layout_boundary: 1 },
        }),
    );
    requireType(plan, PlanType.LAYOUT, 'layout');

    const update: Partial<IPlan> = {};

    const register = new Set<string>();
    const coordinates = data.coordinates ? dedupeById(data.coordinates) : (plan.coordinates ?? []);
    for (const coord of coordinates) register.add(coord.id);
    for (const coord of plan.layout_boundary?.coordinates ?? []) register.add(coord.id);

    if (data.coordinates) {
        update.coordinates = coordinates;
    }

    if (data.plots) {
        for (const plot of data.plots) {
            if (!plot.ids || plot.ids.length < 3) {
                throw ApiError.badRequest(`Plot ${plot.block ?? ''} ${plot.number ?? ''} must have at least 3 corner ids`);
            }
            for (const pid of plot.ids) {
                if (!register.has(pid)) {
                    throw ApiError.badRequest(`Plot ${plot.block ?? ''} ${plot.number ?? ''} references unknown coordinate id '${pid}'`);
                }
            }
        }
        update.plots = data.plots;
    }

    if (data.roads) {
        for (const road of data.roads) {
            for (const pid of road.centerline_ids ?? []) {
                if (!register.has(pid)) {
                    throw ApiError.badRequest(`Road '${road.name ?? ''}' references unknown coordinate id '${pid}'`);
                }
            }
        }
        update.roads = data.roads;
    }

    if (data.layout_mode) {
        update.layout_mode = data.layout_mode;
    }

    if (Object.keys(update).length === 0) {
        throw ApiError.badRequest('Provide coordinates, plots, roads, or layout_mode to edit');
    }

    return requirePlan(await planRepository.editPlan(id, update, options));
};

// ---------------------------------------------------------------------------
// Plan generation (delegates drawing to the Python service)
// ---------------------------------------------------------------------------

/**
 * Legacy CAD import (Task 11): forward an uploaded DWG/DXF to the drawing
 * engine and return what it found.
 *
 * The body is passed through untouched -- the engine parses the multipart, so
 * the API never has to hold a CAD file in memory as fields or add a multipart
 * dependency. Its job here is the boundary it owns: authentication and the
 * size limit.
 */
/**
 * Measure and record what a plan occupies (Task 12).
 *
 * Both halves are measured server-side with `$bsonSize`, so this costs one
 * aggregate per collection rather than pulling documents back to weigh them.
 * Called whenever the point series changes.
 */
export const recordPlanSize = async (id: string): Promise<IPlan['size']> => {
    const [docResult] = await Plan.aggregate<{ bytes: number }>([
        { $match: { _id: new Types.ObjectId(id) } },
        { $project: { bytes: { $bsonSize: '$$ROOT' } } },
    ]);

    const documentBytes = docResult?.bytes ?? 0;
    const pointsBytes = await planPoints.storageBytes(id);

    const size = {
        document_bytes: documentBytes,
        points_bytes: pointsBytes,
        total_bytes: documentBytes + pointsBytes,
        measured_at: new Date(),
    };

    await planRepository.editPlan(id, { size });
    return size;
};

/**
 * Ingest an uploaded coordinate file (Task 12).
 *
 * The file is parsed as it streams in and written to the bucketed point store
 * in batches, so a million-row survey costs the same memory as a hundred-row
 * one. Nothing about this path holds the whole dataset — not the browser,
 * which no longer parses at all, and not this process.
 *
 * The plan document keeps only a preview and a summary. Coordinates used to
 * live in the document itself, which put a hard ceiling of roughly 200,000
 * points on a survey before MongoDB refused the write.
 */
export const uploadCoordinates = async (
    id: string,
    file: Readable,
    meta: {
        fileName?: string;
        kind?: PointKind;
        mapping?: ColumnMapping;
        maxRows?: number;
        /** Called with the running row count, for a job to report progress. */
        onProgress?: (rows: number) => Promise<void> | void;
        /** Spool file this came from, recorded so its columns can be redone. */
        spoolId?: string;
        /** Declared upload size, when the client sent one. */
        declaredBytes?: number;
    },
    options?: RepoOptions,
): Promise<IPlan> => {
    // Refuse an oversized upload before reading a byte of it. The stream
    // enforces the same ceiling for clients that send no Content-Length, but
    // catching it here costs the user seconds rather than minutes.
    if (meta.declaredBytes && meta.declaredBytes > env.MAX_UPLOAD_BYTES) {
        throw new ApiError(
            413,
            `This file is ${Math.round(meta.declaredBytes / (1024 * 1024))} MB, over the ` +
            `${Math.round(env.MAX_UPLOAD_BYTES / (1024 * 1024))} MB upload limit. ` +
            `Split the survey, or reduce its density, and upload again.`,
        );
    }

    const plan = requirePlan(
        await planRepository.getPlanById(id, {
            filter: options?.filter,
            projection: { type: 1, page_size: 1, auto_scale_sizes: 1 },
        }),
    );

    const kind: PointKind = meta.kind ?? 'coordinates';

    // The new series is written to one side and swapped in at the end.
    // Clearing first and writing after meant an unreadable file destroyed the
    // survey already stored -- and left the plan claiming a point count whose
    // points were gone, which is worse than losing them loudly.
    const staging = stagingKindFor(kind);
    await planPoints.clearPoints(id, staging);

    let seq = 0;
    let rows = 0;
    let preview: CoordinateProps[] = [];

    // Writes are kept in flight rather than awaited one at a time. Storing a
    // batch is a single round trip to the database and spends almost all of
    // that time waiting, so running a few at once turns a queue of waits into
    // one wait -- measured 5x faster on a 1.5-million-point survey. The lane
    // count is bounded because each lane holds its batch in memory until the
    // write lands.
    const LANES = 6;
    const inflight = new Set<Promise<unknown>>();
    const dispatch = async (batch: CoordinateProps[]): Promise<void> => {
        // Allocate the sequence before dispatching: the buckets carry it, so
        // they may land in any order, but each must know where it belongs.
        const start = seq;
        seq += planPoints.bucketsFor(batch.length);

        const write = planPoints.appendPoints(id, staging, batch, start)
            .finally(() => inflight.delete(write));
        inflight.add(write);

        // Surface a failed write here rather than letting it become an
        // unhandled rejection while the parser reads on.
        if (inflight.size >= LANES) await Promise.race(inflight);
    };

    let result;
    try {
        result = await streamCoordinates(
            file,
            async batch => {
                await dispatch(batch);
                if (preview.length < PREVIEW_LIMIT) {
                    preview = preview.concat(batch).slice(0, PREVIEW_LIMIT);
                }
                rows += batch.length;
                if (meta.onProgress) await meta.onProgress(rows);
            },
            {
                mapping: meta.mapping,
                // A caller may ask for something smaller, never larger.
                maxRows: Math.min(meta.maxRows || env.MAX_SURVEY_POINTS, env.MAX_SURVEY_POINTS),
                maxBytes: env.MAX_UPLOAD_BYTES,
            },
        );
        // Every batch is stored before the count below is taken.
        await Promise.all(inflight);
    } catch (error) {
        // Let the writes still in flight settle before clearing, or they would
        // land after the cleanup and leave orphaned buckets behind.
        await Promise.allSettled(inflight);
        // Only the half-written replacement goes; whatever was already stored
        // for this plan is untouched.
        await planPoints.clearPoints(id, staging);

        // These carry messages written for the person who uploaded the file, so
        // they must reach them rather than becoming a generic 500.
        if (error instanceof CoordinateLimitError) throw new ApiError(413, error.message);
        if (error instanceof CoordinateParseError) throw ApiError.badRequest(error.message);
        throw error;
    }

    // Whole and readable, so it becomes the series for this plan.
    await planPoints.promoteStaged(id, staging, kind);

    const summary = await planPoints.summarise(id, kind);

    const update: Partial<IPlan> = {
        point_count: summary.count,
        point_summary: summary,
        point_source: {
            file_name: meta.fileName,
            row_count: result.rows,
            skipped_rows: result.skipped,
            uploaded_at: new Date(),
            // Kept so the columns can be re-applied here rather than by
            // sending the survey back to the browser to be rearranged.
            spool_id: meta.spoolId,
            mapping: result.mapping as unknown as Record<string, number | null>,
            kind,
        },
    };

    if (kind === 'coordinates') {
        // The document carries a preview only; the full series lives in the
        // point store and is streamed to the drawing engine on generation.
        update.coordinates = preview;
    }

    // Sizes still derive from the drawing extent for the plan types that use
    // them, and the summary already has the extent -- computed in the database
    // rather than by pulling every point back out.
    if (usesExtentSizing(plan) && summary.count > 0) {
        applySizes(plan, update, computeEmbellishmentsFromExtent(
            (summary.max_easting ?? 0) - (summary.min_easting ?? 0),
            (summary.max_northing ?? 0) - (summary.min_northing ?? 0),
            plan.page_size,
        ));
    }

    await planRepository.editPlan(id, update, options);
    // Measured after the write so the recorded size includes this upload.
    update.size = await recordPlanSize(id);
    return requirePlan(await planRepository.getPlanById(id, options));
};

/**
 * Run one queued generation job (Task 12).
 *
 * Called by the worker, never in a request. Progress is written to the job
 * record at each step; the drawing engine writes to the same record while it
 * reads and draws, which is why the job id goes with the payload.
 */
export const runPlanJob = async (jobId: string): Promise<void> => {
    const job = await planJobs.getJob(jobId);
    if (!job) {
        logger.warn(`job ${jobId} vanished before it could run`);
        return;
    }

    if (!(await planJobs.claimJob(jobId, `${process.pid}@${os.hostname()}`))) {
        logger.warn(`job ${jobId} is already claimed; leaving it alone`);
        return;
    }

    let artifact: { publicId: string; folder: string } | undefined;

    try {
        await planJobs.updateJob(jobId, { status: 'running', stage: 'preparing', percent: 1 });

        const plan = requirePlan(
            await planRepository.getPlanById(job.plan, { filter: { user: job.user } }),
        );
        await preparePlanForDrawing(job.plan, plan);

        // Export the points, reporting as they go. This is the slow half for a
        // large survey, and the half whose progress is worth showing.
        await planJobs.updateJob(jobId, { stage: 'exporting points', percent: 2 });
        const exported = await exportPointsToStorage(job.plan, plan, async (written, total) => {
            // Export occupies the first 40% of the bar; drawing is the rest.
            const percent = total > 0 ? 2 + Math.round((written / total) * 38) : 2;
            await planJobs.updateJob(jobId, {
                stage: 'exporting points', processed: written, total, percent,
            });
        });
        artifact = { publicId: exported.publicId, folder: exported.folder };

        // Named for what this service is doing; the engine overwrites the stage
        // with its own steps the moment it starts reading.
        await planJobs.updateJob(jobId, { stage: 'sending to the drawing engine', percent: 40 });

        // The engine fetches the export itself and reports its own progress
        // against this job id.
        const response = await fetch(`${env.PYTHON_SERVER}/${plan.type}/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points_url: exported.url, job_id: jobId }),
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            logger.error(`job ${jobId} failed at the engine (${response.status}): ${body}`);
            let message = 'The drawing engine could not generate this plan';
            try {
                message = (JSON.parse(body) as { error?: string }).error ?? message;
            } catch {
                /* keep the generic message */
            }
            throw new Error(message);
        }

        const { url } = (await response.json()) as { url: string };
        await planJobs.completeJob(jobId, url);
        logger.info(`job ${jobId} complete`);
    } catch (error) {
        await planJobs.failJob(jobId, (error as Error).message);
        logger.error(`job ${jobId} failed: ${(error as Error).message}`);
    } finally {
        // The export has served its purpose either way.
        if (artifact) await objectStorage.remove(artifact.folder, artifact.publicId);
    }
};

export const inspectCadUpload = async (body: Buffer, contentType: string): Promise<unknown> => {
    if (!contentType) {
        throw ApiError.badRequest('A file upload is required');
    }

    const response = await fetch(`${env.PYTHON_SERVER}/cad/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: new Uint8Array(body),
    });

    const text = await response.text();
    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
        logger.error(`CAD inspection failed (${response.status}): ${text}`);
        throw ApiError.badRequest('The drawing could not be read');
    }

    if (!response.ok) {
        // The engine's messages name the actual problem with the drawing, so
        // pass them through rather than replacing them with a generic one.
        throw ApiError.badRequest(String(parsed.error ?? 'The drawing could not be read'));
    }

    return parsed;
};

/** NDJSON keys. Short on purpose: across a million points the difference
 *  between `northing` and `n` is roughly 20 MB on the wire. */
const WIRE = { kind: 'k', id: 'i', northing: 'n', easting: 'e', elevation: 'z' } as const;

const pointLine = (point: CoordinateProps, kind: 'c' | 'b'): string =>
    `${JSON.stringify({
        [WIRE.kind]: kind,
        [WIRE.id]: point.id,
        [WIRE.northing]: point.northing,
        [WIRE.easting]: point.easting,
        [WIRE.elevation]: point.elevation ?? 0,
    })}\n`;

/**
 * Write a plan and its points to object storage as NDJSON.
 *
 * Used by background jobs: handing the engine a URL rather than a request body
 * means the payload outlives the worker that produced it, so a job can be
 * retried after a restart without pulling a million points back out of
 * MongoDB. The stream is piped straight into the upload, so the export never
 * exists in memory either.
 */
export const exportPointsToStorage = async (
    planId: string,
    plan: IPlan,
    onProgress?: (written: number, total: number) => Promise<void>,
): Promise<{ url: string; publicId: string; folder: string }> => {
    const folder = 'plan_points';
    const publicId = `${planId}-${Date.now()}`;

    const storedCount = await planPoints.countPoints(planId, 'coordinates');
    const boundaryCount = await planPoints.countPoints(planId, 'boundary');
    const total = storedCount + boundaryCount;

    const header = buildEngineHeader(plan, storedCount, boundaryCount);

    let written = 0;
    const body = Readable.from((async function* () {
        yield `${JSON.stringify(header)}\n`;

        for (const [kind, wire] of [['coordinates', 'c'], ['boundary', 'b']] as const) {
            if (kind === 'coordinates' ? !storedCount : !boundaryCount) continue;
            for await (const batch of planPoints.streamPoints(planId, kind)) {
                let chunk = '';
                for (const point of batch) chunk += pointLine(point, wire);
                written += batch.length;
                if (onProgress) await onProgress(written, total);
                yield chunk;
            }
        }
    })());

    const url = await objectStorage.uploadStream(body, { folder, publicId });
    return { url, publicId, folder };
};

/** The plan payload minus the bulk series, which travel separately. */
const buildEngineHeader = (
    plan: IPlan,
    storedCount: number,
    boundaryCount: number,
): Record<string, unknown> => {
    const header: Record<string, unknown> = { ...(plan as unknown as Record<string, unknown>) };
    if (storedCount) header.coordinates = [];
    if (boundaryCount) {
        const key = plan.type === PlanType.LAYOUT ? 'layout_boundary' : 'topographic_boundary';
        const boundary = header[key] as Record<string, unknown> | undefined;
        if (boundary) header[key] = { ...boundary, coordinates: [] };
    }
    return header;
};

/**
 * Send a plan to the drawing engine (Task 12).
 *
 * A plan whose points live in the point store is streamed as NDJSON: the plan
 * on the first line, then one point per line. `JSON.stringify` on a
 * million-point plan builds about 85 MB of string in memory before a byte is
 * sent, and the engine then parses all of it back — so neither side ever
 * materialises the survey now. The engine thins points to the plotting scale
 * as it reads them.
 *
 * Plans without a stored point series keep the plain JSON body they always
 * used, so nothing about the small-plan path changes.
 */
const sendPlanToEngine = async (planId: string, plan: IPlan): Promise<Response> => {
    const url = `${env.PYTHON_SERVER}/${plan.type}/plan`;

    const storedCount = await planPoints.countPoints(planId, 'coordinates');
    const boundaryCount = await planPoints.countPoints(planId, 'boundary');

    if (!storedCount && !boundaryCount) {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plan),
        });
    }

    // The header carries everything except the bulk series, which follow it.
    const header = buildEngineHeader(plan, storedCount, boundaryCount);

    const body = new ReadableStream<Uint8Array>({
        async start(controller) {
            const encoder = new TextEncoder();
            try {
                controller.enqueue(encoder.encode(`${JSON.stringify(header)}\n`));

                for (const [kind, wire] of [['coordinates', 'c'], ['boundary', 'b']] as const) {
                    if (kind === 'coordinates' ? !storedCount : !boundaryCount) continue;
                    for await (const batch of planPoints.streamPoints(planId, kind)) {
                        let chunk = '';
                        for (const point of batch) chunk += pointLine(point, wire);
                        controller.enqueue(encoder.encode(chunk));
                    }
                }
                controller.close();
            } catch (err) {
                controller.error(err);
            }
        },
    });

    logger.info(`streaming ${storedCount} points and ${boundaryCount} boundary points to the engine`);

    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-ndjson' },
        body,
        // Required by undici when the body is a stream.
        duplex: 'half',
    } as RequestInit & { duplex: 'half' });
};

/**
 * The plan's full coordinate register.
 *
 * `plan.coordinates` holds only a preview once a survey is in the point store,
 * so anything that resolves beacon ids -- parcel legs, areas -- has to read the
 * stored series instead. Using the preview would quietly compute a parcel from
 * whichever corners happened to fall in the first 200 points, and put a wrong
 * area on a legal document.
 */
const fullCoordinates = async (id: string, plan: IPlan): Promise<CoordinateProps[]> => {
    const embedded = plan.coordinates ?? [];
    const stored = await planPoints.countPoints(id, 'coordinates');
    if (!stored || stored <= embedded.length) return embedded;
    return planPoints.readAllPoints(id, 'coordinates');
};

/**
 * Prepare a plan for drawing: recompute the legs and areas that are derived
 * from its geometry. Shared by the inline and background paths so a plan is
 * generated identically either way.
 */
const preparePlanForDrawing = async (id: string, plan: IPlan): Promise<void> => {
    // Compute parcel legs and areas from the plan coordinates
    if (plan.type === PlanType.CADASTRAL && plan.parcels) {
        const register = await fullCoordinates(id, plan);
        const coordinateMap: Record<string, CoordinateProps> = {};
        for (const coord of register) {
            coordinateMap[coord.id] = coord;
        }

        for (const parcel of plan.parcels) {
            const points = parcel.ids.map(pid => coordinateMap[pid]).filter(Boolean);
            if (points.length < 2) continue;

            const result = backComputation({ points, area: true, round: true });
            parcel.legs = result.traverse_legs;
            parcel.area = result.traverse.area;
        }
    }

    if (plan.type === PlanType.TOPOGRAPHIC && plan.topographic_boundary?.coordinates?.length) {
        const result = backComputation({ points: plan.topographic_boundary.coordinates, area: true, round: true });
        plan.topographic_boundary.legs = result.traverse_legs;
        plan.topographic_boundary.area = result.traverse.area;
        if (plan.topographic_setting) {
            plan.topographic_setting.show_mesh = false;
        }
    }

    if (plan.type === PlanType.LAYOUT && plan.layout_boundary?.coordinates?.length) {
        const result = backComputation({ points: plan.layout_boundary.coordinates, area: true, round: true });
        plan.layout_boundary.legs = result.traverse_legs;
        plan.layout_boundary.area = result.traverse.area;
    }

};

/**
 * Should this plan be drawn in the background?
 *
 * Sized by point count rather than by wall-clock guesswork: the point count is
 * known before any work starts, and it is what actually drives the cost --
 * exporting the points, shipping them, triangulating and contouring all scale
 * with it.
 */
/**
 * Whether an upload is too big to parse inside the request.
 *
 * Off by default. Judged on the declared size when it is on, because that is
 * the only thing known before a byte is read.
 *
 * Queueing an upload turned out not to buy what it looked like it would: the
 * request returned in a second, but the client cannot show a coordinate table
 * until the survey is stored, so it waited exactly as long -- through a
 * polling loop, with a worker in between that can fail on its own. The work
 * that made storing five times faster is what actually helped.
 */
export const shouldQueueUpload = (declaredBytes?: number): boolean =>
    env.ASYNC_UPLOAD_BYTES > 0
    && Boolean(declaredBytes && declaredBytes >= env.ASYNC_UPLOAD_BYTES);

export interface UploadResult {
    plan?: IPlan;
    job?: PlanJob;
}

/**
 * Take a coordinate upload, inline or as a background job.
 *
 * A large file is written to the upload spool and a job id returned straight
 * away. Parsing and storing a 1.5-million-point survey is about a minute of
 * database round trips, and a request held open that long is a hang as far as
 * the browser is concerned.
 *
 * The file goes to local disk rather than to object storage. That was the
 * first design and it was measured out: pushing 58 MB to a remote service
 * took longer than parsing and storing the survey outright, so the client
 * would have waited just as long for the privilege of waiting again.
 */
export const receiveCoordinateUpload = async (
    id: string,
    file: Readable,
    meta: {
        fileName?: string;
        kind?: PointKind;
        mapping?: ColumnMapping;
        maxRows?: number;
        declaredBytes?: number;
    },
    userId: string,
    options?: RepoOptions,
    /** Record the job without publishing it, so the caller can run it. */
    publish = true,
): Promise<UploadResult> => {
    // Confirm the plan exists and that this caller may write to it before
    // spending any time on the file itself.
    const plan = requirePlan(await planRepository.getPlanById(id, options));

    if (meta.declaredBytes && meta.declaredBytes > env.MAX_UPLOAD_BYTES) {
        throw new ApiError(413,
            `That file is ${Math.round(meta.declaredBytes / (1024 * 1024))} MB, over the ` +
            `${Math.round(env.MAX_UPLOAD_BYTES / (1024 * 1024))} MB upload limit. ` +
            'Split the survey or reduce it before uploading.');
    }

    // The file is always spooled, whether or not the work is queued. Writing
    // it to disk costs a fraction of a second and it is what lets the user
    // change their mind about the columns afterwards: the survey is re-read
    // here rather than sent back to the browser to be rearranged there.
    const spoolId = randomUUID();
    const previous = plan.point_source?.spool_id;
    await uploadSpool.park(spoolId, file);
    if (previous && previous !== spoolId) await uploadSpool.discard(previous);

    if (!shouldQueueUpload(meta.declaredBytes)) {
        return {
            plan: await uploadCoordinates(
                id, uploadSpool.read(spoolId), { ...meta, spoolId }, options,
            ),
        };
    }

    let job;
    try {
        job = await planJobs.createJob(id, userId, 0, {
            kind: 'upload',
            queue: publish,
            payload: {
                spoolId,
                fileName: meta.fileName,
                kindOfPoints: (meta.kind ?? 'coordinates') as 'coordinates' | 'boundary',
                mapping: meta.mapping,
                bytes: meta.declaredBytes ?? await uploadSpool.sizeOf(spoolId),
            },
        });
    } catch (error) {
        // No job means nothing will ever read the file.
        await uploadSpool.discard(spoolId);
        throw error;
    }

    logger.info(`queued upload for plan ${plan.id} as job ${job.id} `
        + `(${((meta.declaredBytes ?? 0) / 1e6).toFixed(1)} MB)`);
    return { job };
};

/**
 * Re-read a survey that is already uploaded, using different columns.
 *
 * This is the "which column is which" dialog, done properly. The obvious
 * implementation is to hand the rows to the browser, let the user drag the
 * columns about, and send the result back -- which works until the survey is
 * a million points, at which point it is the thing that makes the tab die.
 *
 * So the file stays here. The dialog is shown a preview, the user picks
 * columns, and only the column indices come back; the survey is re-read from
 * the spool and the point store replaced. Nothing large moves in either
 * direction.
 */
export const remapCoordinates = async (
    id: string,
    mapping: ColumnMapping,
    kind: PointKind = 'coordinates',
    options?: RepoOptions,
): Promise<IPlan> => {
    const plan = requirePlan(await planRepository.getPlanById(id, options));
    const spoolId = plan.point_source?.spool_id;

    if (!spoolId || !(await uploadSpool.exists(spoolId))) {
        throw ApiError.badRequest(
            'The uploaded file is no longer available to re-read. Upload it '
            + 'again to change which column is which.',
        );
    }

    return uploadCoordinates(
        id,
        uploadSpool.read(spoolId),
        {
            fileName: plan.point_source?.file_name,
            kind,
            mapping,
            spoolId,
        },
        options,
    );
};

/**
 * Worker side of a coordinate upload: read the spooled file, parse it, store
 * it, and report progress as it goes.
 */
export const runUploadJob = async (jobId: string): Promise<void> => {
    const job = await planJobs.getJob(jobId);
    if (!job) throw new Error(`job ${jobId} not found`);

    const payload = job.payload;
    if (!payload?.spoolId) throw new Error(`upload job ${jobId} has no spooled file`);

    if (!(await planJobs.claimJob(jobId, `${process.pid}@${os.hostname()}`))) {
        logger.warn(`upload job ${jobId} is already claimed; leaving it alone`);
        return;
    }

    if (!(await uploadSpool.exists(payload.spoolId))) {
        // Almost always means the worker cannot see the API's spool directory.
        // Worth saying so plainly: the alternative is a job that fails with
        // "file not found" and a long afternoon.
        await planJobs.failJob(jobId,
            'The uploaded file could not be found. The API and the worker must '
            + 'share the upload spool directory (UPLOAD_SPOOL_DIR).');
        logger.error(`upload job ${jobId}: ${payload.spoolId} is not in `
            + `${env.UPLOAD_SPOOL_DIR} -- is the spool shared with the API?`);
        return;
    }

    try {
        // Rows are the unit the client sees, so progress is reported in rows.
        // The total is estimated from the file size until the parse finishes:
        // the real count is not known until the last row is read.
        const estimate = payload.bytes ? Math.max(1, Math.round(payload.bytes / 40)) : 0;
        let lastReport = 0;

        await planJobs.reportProgress(jobId, 'reading the survey', 0, estimate);

        const plan = await uploadCoordinates(
            job.plan,
            uploadSpool.read(payload.spoolId),
            {
                fileName: payload.fileName,
                kind: payload.kindOfPoints,
                mapping: payload.mapping as ColumnMapping | undefined,
                declaredBytes: payload.bytes,
                spoolId: payload.spoolId,
                onProgress: async rows => {
                    // The client polls every 1.5s; reporting more often than
                    // it can read is noise on both sides.
                    if (rows - lastReport < 25_000) return;
                    lastReport = rows;
                    await planJobs.reportProgress(
                        jobId, 'storing survey points', rows, Math.max(estimate, rows),
                    );
                },
            },
        );

        await planJobs.completeUpload(
            jobId,
            plan.point_count ?? 0,
            plan.point_source?.skipped_rows ?? 0,
        );
    } catch (error) {
        const message = error instanceof ApiError
            ? error.message
            : 'The survey could not be read';
        await planJobs.failJob(jobId, message);
        logger.error(`upload job ${jobId} failed: ${(error as Error).message}`);
    }
    // Deliberately not discarded here. The file is what a column remap
    // re-reads; the worker's sweep removes it once it is old enough that no
    // one is still adjusting the columns.
};

export const shouldRunAsync = (plan: IPlan): boolean =>
    (plan.point_count ?? 0) >= env.ASYNC_POINT_THRESHOLD;

export interface GenerateResult {
    url?: string;
    job?: PlanJob;
}

/**
 * Generate a plan, inline or as a background job depending on its size.
 *
 * A small plan is drawn in the request as it always was. A large one returns a
 * job id immediately: the work can run for minutes, and a request held open
 * that long tells the user nothing and eventually meets a proxy timeout.
 */
export const generatePlan = async (
    id: string,
    userId: string,
    options?: RepoOptions,
): Promise<GenerateResult> => {
    const plan = requirePlan(await planRepository.getPlanById(id, options));

    if (shouldRunAsync(plan)) {
        if (!objectStorage.isStorageConfigured()) {
            throw ApiError.badRequest(
                'This survey is too large to generate in a single request, and ' +
                'background generation is not configured on this server.',
            );
        }
        const job = await planJobs.createJob(id, userId, plan.point_count ?? 0);
        logger.info(`queued plan ${id} as job ${job.id} (${plan.point_count} points)`);
        return { job };
    }

    await preparePlanForDrawing(id, plan);
    const response = await sendPlanToEngine(id, plan);

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        logger.error(`Plan generation failed (${response.status}): ${body}`);
        throw ApiError.badRequest('Failed to generate plan');
    }

    const responseData = (await response.json()) as { url: string };
    return { url: responseData.url };
};

// ---------------------------------------------------------------------------
// Computation conversion / import
// ---------------------------------------------------------------------------

/** Run a plan's stored computations and write the results into its coordinates/boundary/elevations. */
const applyComputationsToPlan = async (
    plan: IPlan,
    source: Pick<
        IPlan,
        | 'forward_computation_data'
        | 'traverse_computation_data'
        | 'back_computation_data'
        | 'differential_leveling_data'
    >,
    replace: boolean,
): Promise<void> => {
    const applyCoordinates = async (raw: CoordinateProps[]) => {
        // Computed legs list stations as interleaved to/from pairs; dedupe
        // to the station order (A, P1, P2, ...) before writing them.
        const coordinates = dedupeById(raw);

        if (plan.type === PlanType.CADASTRAL) {
            const merged = replace ? coordinates : [...coordinates, ...(plan.coordinates ?? [])];
            await editCoordinates(plan.id, merged);
        }

        if (plan.type === PlanType.TOPOGRAPHIC) {
            const existing = plan.topographic_boundary?.coordinates ?? [];
            const merged = replace ? coordinates : [...coordinates, ...existing];
            await editTopoBoundary(plan.id, { coordinates: merged });
        }

        if (plan.type === PlanType.LAYOUT) {
            const existing = plan.layout_boundary?.coordinates ?? [];
            const merged = replace ? coordinates : [...coordinates, ...existing];
            await editLayoutBoundary(plan.id, { coordinates: merged });
        }
    };

    if (source.forward_computation_data) {
        const result = forwardComputation(source.forward_computation_data);

        const coordinates: CoordinateProps[] = [result.start];
        for (const leg of result.computed_legs) {
            coordinates.push(leg.to);
            coordinates.push(leg.from);
        }

        await applyCoordinates(coordinates);
    }

    if (source.traverse_computation_data) {
        const result = traverseComputation(source.traverse_computation_data);

        const coordinates: CoordinateProps[] = [];
        for (const leg of result.traverse_legs) {
            coordinates.push(leg.to);
            coordinates.push(leg.from);
        }

        await applyCoordinates(coordinates);
    }

    if (source.back_computation_data) {
        // Back computation starts from coordinates rather than deriving them, so
        // the stored points are the coordinates. A closing point repeated at the
        // end is a drawing artefact, not a station, and dedupeById drops it.
        await applyCoordinates(source.back_computation_data.points);
    }

    if (source.differential_leveling_data && plan.type === PlanType.ROUTE) {
        const result = differentialLeveling(source.differential_leveling_data);

        const elevations: ElevationProps[] = result.stations.map(station => ({
            id: station.stn,
            chainage: station.chainage as string,
            elevation: station.reduced_level as number,
        }));

        const merged = replace ? elevations : [...elevations, ...(plan.elevations ?? [])];
        await editElevations(plan.id, merged);
    }
};

/** Turn a computation-only plan into a drawable plan of the given type. */
export const convertComputation = async (id: string, type: PlanType, options?: RepoOptions): Promise<void> => {
    let plan = requirePlan(await planRepository.getPlanById(id, options));

    if (!plan.computation_only) {
        throw ApiError.badRequest('Only computations can be converted to a plan');
    }

    plan = requirePlan(
        await planRepository.editPlan(plan.id, {
            computation_only: false,
            type,
            topographic_setting: type === PlanType.TOPOGRAPHIC ? defaultTopographicSetting() : undefined,
            longitudinal_profile_parameters:
                type === PlanType.ROUTE ? defaultLongitudinalProfileParameters() : undefined,
        }),
    );

    await applyComputationsToPlan(plan, plan, true);
};

/** Copy the computations of a computation-only plan into an existing plan. */
export const importComputation = async (
    id: string,
    data: ImportComputationInput,
    options?: RepoOptions,
): Promise<void> => {
    let plan = requirePlan(await planRepository.getPlanById(id, options));

    if (plan.computation_only) {
        throw ApiError.badRequest('Kindly provide a non computational plan to import into');
    }

    const computation = await planRepository.getPlanById(data.computation_id, options);
    if (!computation) throw ApiError.notFound('Computation not found');

    if (!computation.computation_only) {
        throw ApiError.badRequest('Kindly provide a computational plan to import from');
    }

    const edit: Partial<IPlan> = {};
    if (computation.forward_computation_data) edit.forward_computation_data = computation.forward_computation_data;
    if (computation.traverse_computation_data) edit.traverse_computation_data = computation.traverse_computation_data;
    if (computation.back_computation_data) edit.back_computation_data = computation.back_computation_data;
    if (computation.differential_leveling_data)
        edit.differential_leveling_data = computation.differential_leveling_data;

    plan = requirePlan(await planRepository.editPlan(plan.id, edit));

    await applyComputationsToPlan(plan, computation, data.replace);
};
