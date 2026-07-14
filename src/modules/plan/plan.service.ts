import env from '@config/env';
import { RepoOptions } from '@db/types';
import { ApiError } from '@utils/api-error';
import logger from '@utils/logger';
import { CoordinateProps } from '@modules/traverse/traverse.interface';
import { backComputation, forwardComputation, traverseComputation } from '@modules/traverse/traverse.service';
import { differentialLeveling } from '@modules/leveling/leveling.service';
import projectRepository from '@modules/project/project.repository';
import planRepository from './plan.repository';
import { computePlanEmbellishments, computeRouteEmbellishments, PlanEmbellishments } from './plan.embellishments';
import {
    BeaconType,
    CreatePlanInput,
    EditPlanInput,
    ElevationProps,
    IPlan,
    ImportComputationInput,
    LayoutBoundary,
    LayoutDataInput,
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
});

const defaultLongitudinalProfileParameters = (): LongitudinalProfileParameters => ({
    horizontal_scale: 1.0,
    vertical_scale: 10,
    profile_origin: [0.0, 0.0],
    station_interval: 10,
    elevation_interval: 1.0,
    starting_chainage: 0.0,
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

const applySizes = (update: Partial<IPlan>, embellishments: PlanEmbellishments | null): void => {
    if (!embellishments) return;
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
        font_size: 12,
        origin: PlanOrigin.UTM_ZONE_31,
        scale: 1000,
        beacon_type: BeaconType.BOX,
        beacon_size: 0.3,
        label_size: 0.2,
        page_size: PageSize.A4,
        page_orientation: PageOrientation.PORTRAIT,
        title: 'Untitled Plan',
        footers: [],
        footer_size: 0.5,
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
                topographic_boundary: 1,
                topographic_setting: 1,
                elevations: 1,
                longitudinal_profile_parameters: 1,
                route_parameters: 1,
            },
        }),
    );

    const updatedCoordinates = dedupeById(coordinates);
    const update: Partial<IPlan> = { coordinates: updatedCoordinates };

    if (plan.type === PlanType.ROUTE) {
        // Route sheets are sized by their drawn views, not a boundary
        applySizes(update, computeRouteEmbellishments({
            elevations: plan.elevations,
            coordinates: updatedCoordinates,
            longitudinal_profile_parameters: plan.longitudinal_profile_parameters,
            route_parameters: plan.route_parameters,
        }));
        return requirePlan(await planRepository.editPlan(id, update, options));
    }

    // Element sizes derive from the full extent of the drawing, so include
    // the topographic boundary when there is one.
    const embellishmentCoordinates = [...updatedCoordinates];
    if (plan.type === PlanType.TOPOGRAPHIC && plan.topographic_boundary?.coordinates) {
        embellishmentCoordinates.push(...plan.topographic_boundary.coordinates);
    }

    if (embellishmentCoordinates.length > 0) {
        const embellishments = computePlanEmbellishments(embellishmentCoordinates);
        applySizes(update, embellishments);

        if (plan.type === PlanType.TOPOGRAPHIC && plan.topographic_setting) {
            plan.topographic_setting.point_label_scale = embellishments.point_label_scale;
            plan.topographic_setting.contour_label_scale = embellishments.contour_label_scale;
            update.topographic_setting = plan.topographic_setting;
        }
    }

    return requirePlan(await planRepository.editPlan(id, update, options));
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
    applySizes(update, computeRouteEmbellishments({
        elevations: updatedElevations,
        coordinates: plan.coordinates,
        longitudinal_profile_parameters: plan.longitudinal_profile_parameters,
        route_parameters: plan.route_parameters,
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
        topographic_boundary: boundary,
        font_size: embellishments.font_size,
        beacon_size: embellishments.beacon_size,
        label_size: embellishments.label_size,
        footer_size: embellishments.footer_size,
    };

    if (plan.topographic_setting) {
        plan.topographic_setting.point_label_scale = embellishments.point_label_scale;
        plan.topographic_setting.contour_label_scale = embellishments.contour_label_scale;
        update.topographic_setting = plan.topographic_setting;
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
    applySizes(update, computeRouteEmbellishments({
        elevations: plan.elevations,
        coordinates: plan.coordinates,
        longitudinal_profile_parameters: params,
        route_parameters: plan.route_parameters,
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
    applySizes(update, computeRouteEmbellishments({
        elevations: plan.elevations,
        coordinates: plan.coordinates,
        longitudinal_profile_parameters: plan.longitudinal_profile_parameters,
        route_parameters: params,
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
    options?: RepoOptions,
): Promise<IPlan> => {
    const plan = requirePlan(
        await planRepository.getPlanById(id, { filter: options?.filter, projection: { type: 1 } }),
    );
    requireType(plan, PlanType.LAYOUT, 'layout');

    return requirePlan(await planRepository.editPlan(id, { layout_parameters: params }, options));
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

    if (Object.keys(update).length === 0) {
        throw ApiError.badRequest('Provide coordinates, plots, or roads to edit');
    }

    return requirePlan(await planRepository.editPlan(id, update, options));
};

// ---------------------------------------------------------------------------
// Plan generation (delegates drawing to the Python service)
// ---------------------------------------------------------------------------

export const generatePlan = async (id: string, options?: RepoOptions): Promise<{ url: string }> => {
    const plan = requirePlan(await planRepository.getPlanById(id, options));

    // Compute parcel legs and areas from the plan coordinates
    if (plan.type === PlanType.CADASTRAL && plan.parcels) {
        const coordinateMap: Record<string, CoordinateProps> = {};
        for (const coord of plan.coordinates ?? []) {
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

    const response = await fetch(`${env.PYTHON_SERVER}/${plan.type}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
    });

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
    source: Pick<IPlan, 'forward_computation_data' | 'traverse_computation_data' | 'differential_leveling_data'>,
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
    if (computation.differential_leveling_data)
        edit.differential_leveling_data = computation.differential_leveling_data;

    plan = requirePlan(await planRepository.editPlan(plan.id, edit));

    await applyComputationsToPlan(plan, computation, data.replace);
};
