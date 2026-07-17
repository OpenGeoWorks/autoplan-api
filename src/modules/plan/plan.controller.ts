import { Request, Response } from 'express';
import catchAsync from '@utils/catch-async';
import { sendSuccess, sendNoContent } from '@utils/api-response';
import { parseQuery } from '@utils/query-parser';
import { RepoOptions } from '@db/types';
import * as planService from './plan.service';
import {
    CreatePlanInput,
    EditPlanInput,
    ImportComputationInput,
    LayoutBoundary,
    LayoutDataInput,
    LayoutMode,
    LayoutParameters,
    LongitudinalProfileParameters,
    PlanType,
    RouteParameters,
    TopographicBoundary,
    TopographicSetting,
} from './plan.interface';
import * as validate from './plan.validation';

/** Ownership scope plus the projection returned to the client. */
const ownerOptions = (req: Request, projection?: Record<string, number>): RepoOptions => ({
    filter: { user: req.user!.id },
    ...(projection ? { projection: { ...projection, created_at: 1, updated_at: 1 } } : {}),
});

export const createPlanController = catchAsync(async (req: Request, res: Response) => {
    validate.validateCreatePlan(req);
    const plan = await planService.createPlan(req.body as CreatePlanInput, ownerOptions(req));
    sendSuccess(res, plan);
});

export const listPlansController = catchAsync(async (req: Request, res: Response) => {
    const options = parseQuery(
        req.query as Record<string, string>,
        ['type', 'bool-computation_only'],
        ['created_at', 'updated_at'],
    );
    options.filter = options.filter ?? {};
    options.filter.user = req.user!.id;
    options.projection = {
        id: 1,
        name: 1,
        type: 1,
        computation_only: 1,
        created_at: 1,
        updated_at: 1,
    };

    const plans = await planService.listPlans(req.params.project_id, options);
    sendSuccess(res, plans);
});

export const fetchPlanController = catchAsync(async (req: Request, res: Response) => {
    const plan = await planService.fetchPlan(req.params.plan_id, ownerOptions(req));
    sendSuccess(res, plan);
});

export const editPlanController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditPlan(req);
    const plan = await planService.editPlan(
        req.params.plan_id,
        req.body as EditPlanInput,
        ownerOptions(req, {
            name: 1,
            font: 1,
            font_size: 1,
            title: 1,
            address: 1,
            local_govt: 1,
            state: 1,
            plan_number: 1,
            origin: 1,
            scale: 1,
            beacon_type: 1,
            beacon_size: 1,
            label_size: 1,
            personel_name: 1,
            surveyor_name: 1,
            page_size: 1,
            page_orientation: 1,
            footers: 1,
            footer_size: 1,
            dxf_version: 1,
        }),
    );
    sendSuccess(res, plan);
});

export const deletePlanController = catchAsync(async (req: Request, res: Response) => {
    await planService.deletePlan(req.params.plan_id, ownerOptions(req));
    sendNoContent(res);
});

export const editCoordinatesController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditCoordinates(req);
    const plan = await planService.editCoordinates(
        req.params.plan_id,
        (req.body as { coordinates: never[] }).coordinates,
        ownerOptions(req, { coordinates: 1 }),
    );
    sendSuccess(res, plan);
});

export const editElevationsController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditElevations(req);
    const plan = await planService.editElevations(
        req.params.plan_id,
        (req.body as { elevations: never[] }).elevations,
        ownerOptions(req, { elevations: 1 }),
    );
    sendSuccess(res, plan);
});

export const editParcelsController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditParcels(req);
    const plan = await planService.editParcels(
        req.params.plan_id,
        (req.body as { parcels: never[] }).parcels,
        ownerOptions(req, { parcels: 1 }),
    );
    sendSuccess(res, plan);
});

export const editTraverseComputationController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditTraverseData(req);
    const plan = await planService.editTraverseComputation(
        req.params.plan_id,
        req.body,
        ownerOptions(req, { traverse_computation_data: 1 }),
    );
    sendSuccess(res, plan);
});

export const editForwardComputationController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditForwardData(req);
    const plan = await planService.editForwardComputation(
        req.params.plan_id,
        req.body,
        ownerOptions(req, { forward_computation_data: 1 }),
    );
    sendSuccess(res, plan);
});

export const editDifferentialLevelingController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditDifferentialLevelingData(req);
    const plan = await planService.editDifferentialLeveling(
        req.params.plan_id,
        req.body,
        ownerOptions(req, { differential_leveling_data: 1 }),
    );
    sendSuccess(res, plan);
});

export const editTopoBoundaryController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditTopoBoundary(req);
    const plan = await planService.editTopoBoundary(
        req.params.plan_id,
        req.body as TopographicBoundary,
        ownerOptions(req, { topographic_boundary: 1 }),
    );
    sendSuccess(res, plan);
});

export const editTopoSettingController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditTopoSetting(req);
    const plan = await planService.editTopoSetting(
        req.params.plan_id,
        req.body as TopographicSetting,
        ownerOptions(req, { topographic_setting: 1 }),
    );
    sendSuccess(res, plan);
});

export const editLongitudinalProfileParametersController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditLongitudinalProfileParameters(req);
    const plan = await planService.editLongitudinalProfileParameters(
        req.params.plan_id,
        req.body as LongitudinalProfileParameters,
        ownerOptions(req, { longitudinal_profile_parameters: 1 }),
    );
    sendSuccess(res, plan);
});

export const editRouteParametersController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditRouteParameters(req);
    const plan = await planService.editRouteParameters(
        req.params.plan_id,
        req.body as RouteParameters,
        ownerOptions(req, { route_parameters: 1 }),
    );
    sendSuccess(res, plan);
});

export const editLayoutBoundaryController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditLayoutBoundary(req);
    const plan = await planService.editLayoutBoundary(
        req.params.plan_id,
        req.body as LayoutBoundary,
        ownerOptions(req, { layout_boundary: 1 }),
    );
    sendSuccess(res, plan);
});

export const editLayoutParametersController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditLayoutParameters(req);
    const { layout_mode, ...params } = req.body as LayoutParameters & { layout_mode?: LayoutMode };
    const plan = await planService.editLayoutParameters(
        req.params.plan_id,
        params,
        layout_mode,
        ownerOptions(req, { layout_parameters: 1, layout_mode: 1 }),
    );
    sendSuccess(res, plan);
});

export const editLayoutDataController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditLayoutData(req);
    const plan = await planService.editLayoutData(
        req.params.plan_id,
        req.body as LayoutDataInput,
        ownerOptions(req, { coordinates: 1, plots: 1, roads: 1, layout_mode: 1 }),
    );
    sendSuccess(res, plan);
});

export const generatePlanController = catchAsync(async (req: Request, res: Response) => {
    const result = await planService.generatePlan(req.params.plan_id, ownerOptions(req));
    sendSuccess(res, result);
});

export const convertComputationController = catchAsync(async (req: Request, res: Response) => {
    validate.validateConvertComputation(req);
    await planService.convertComputation(req.params.plan_id, (req.body as { type: PlanType }).type, ownerOptions(req));
    sendNoContent(res);
});

export const importComputationController = catchAsync(async (req: Request, res: Response) => {
    validate.validateImportComputation(req);
    await planService.importComputation(req.params.plan_id, req.body as ImportComputationInput, ownerOptions(req));
    sendNoContent(res);
});
