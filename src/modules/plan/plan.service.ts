import env from '@config/env';
import { RepoOptions } from '@db/types';
import { ApiError } from '@utils/api-error';
import logger from '@utils/logger';
import { CoordinateProps } from '@modules/traverse/traverse.interface';
import { backComputation, forwardComputation, traverseComputation } from '@modules/traverse/traverse.service';
import { differentialLeveling } from '@modules/leveling/leveling.service';
import projectRepository from '@modules/project/project.repository';
import planRepository from './plan.repository';
import { computePlanEmbellishments } from './plan.embellishments';
import {
    BeaconType,
    CreatePlanInput,
    EditPlanInput,
    ElevationProps,
    IPlan,
    ImportComputationInput,
    LongitudinalProfileParameters,
    PageOrientation,
    PageSize,
    ParcelProps,
    PlanOrigin,
    PlanType,
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
            projection: { type: 1, topographic_boundary: 1, topographic_setting: 1 },
        }),
    );

    const updatedCoordinates = dedupeById(coordinates);

    // Element sizes derive from the full extent of the drawing, so include
    // the topographic boundary when there is one.
    const embellishmentCoordinates = [...updatedCoordinates];
    if (plan.type === PlanType.TOPOGRAPHIC && plan.topographic_boundary?.coordinates) {
        embellishmentCoordinates.push(...plan.topographic_boundary.coordinates);
    }

    const update: Partial<IPlan> = { coordinates: updatedCoordinates };

    if (embellishmentCoordinates.length > 0) {
        const embellishments = computePlanEmbellishments(embellishmentCoordinates);
        update.font_size = embellishments.font_size;
        update.beacon_size = embellishments.beacon_size;
        update.label_size = embellishments.label_size;
        update.footer_size = embellishments.footer_size;

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
        await planRepository.getPlanById(id, { filter: options?.filter, projection: { type: 1 } }),
    );
    requireType(plan, PlanType.ROUTE, 'route survey');

    return requirePlan(await planRepository.editPlan(id, { elevations: dedupeById(elevations) }, options));
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
        await planRepository.getPlanById(id, { filter: options?.filter, projection: { type: 1 } }),
    );
    requireType(plan, PlanType.ROUTE, 'route');

    return requirePlan(await planRepository.editPlan(id, { longitudinal_profile_parameters: params }, options));
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

        if (plan.type === PlanType.CADASTRAL || plan.type === PlanType.LAYOUT) {
            const merged = replace ? coordinates : [...coordinates, ...(plan.coordinates ?? [])];
            await editCoordinates(plan.id, merged);
        }

        if (plan.type === PlanType.TOPOGRAPHIC) {
            const existing = plan.topographic_boundary?.coordinates ?? [];
            const merged = replace ? coordinates : [...coordinates, ...existing];
            await editTopoBoundary(plan.id, { coordinates: merged });
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
