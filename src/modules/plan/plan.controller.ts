import { Request, Response } from 'express';
import catchAsync from '@utils/catch-async';
import { sendSuccess, sendNoContent } from '@utils/api-response';
import { ApiError } from '@utils/api-error';
import { parseQuery } from '@utils/query-parser';
import { RepoOptions } from '@db/types';
import * as planService from './plan.service';
import { previewText } from './coordinate-parser';

/** Most of a file the preview endpoint will read. Enough rows to judge the
 *  columns by, far too few to be a way of uploading a survey. */
const PREVIEW_BYTES = 256 * 1024;
import planJobs from './plan-job';
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

export const editBackComputationController = catchAsync(async (req: Request, res: Response) => {
    validate.validateEditBackData(req);
    const plan = await planService.editBackComputation(
        req.params.plan_id,
        req.body,
        ownerOptions(req, { back_computation_data: 1 }),
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

/**
 * Upload a coordinate file (Task 12).
 *
 * The request body is the file itself, streamed straight into the parser --
 * there is no multipart wrapper to unpick and, more to the point, no step at
 * which the whole survey exists as an array. Metadata that used to ride in
 * form fields travels as query parameters instead.
 */
/**
 * Column preview for the mapping dialog.
 *
 * The client sends the first few kilobytes of the file and gets back the
 * delimiter, whether there is a header, the detected column mapping and a
 * handful of sample rows. Nothing else: the point of moving parsing to the
 * server was that a survey never has to fit in a browser tab, and that would
 * be undone by shipping every row back so the user could pick columns.
 */
export const previewCoordinatesController = catchAsync(async (req: Request, res: Response) => {
    const chunks: Buffer[] = [];
    let bytes = 0;

    await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk: Buffer) => {
            // Hard cap. The head of the file is all that is needed, and this
            // endpoint must never become a way to push a whole survey into
            // memory.
            if (bytes >= PREVIEW_BYTES) return;
            bytes += chunk.length;
            chunks.push(chunk);
        });
        req.on('end', () => resolve());
        req.on('error', reject);
    });

    const text = Buffer.concat(chunks).slice(0, PREVIEW_BYTES).toString('utf8');
    if (!text.trim()) throw ApiError.badRequest('No file content was received');

    sendSuccess(res, previewText(text));
});

/**
 * Apply a different column arrangement to a survey already uploaded.
 *
 * Takes column indices, not coordinates: the file is re-read on this side.
 */
/** Discard an uploaded survey so the plan goes back to a table. */
export const clearUploadedCoordinatesController = catchAsync(
    async (req: Request, res: Response) => {
        const kind = (req.query.kind as string) === 'boundary' ? 'boundary' : 'coordinates';
        const plan = await planService.clearUploadedCoordinates(
            req.params.plan_id, kind, ownerOptions(req),
        );
        sendSuccess(res, plan);
    },
);

export const remapCoordinatesController = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as { mapping?: Record<string, number | null>; kind?: string };
    if (!body?.mapping || typeof body.mapping !== 'object') {
        throw ApiError.badRequest('mapping is required');
    }

    const plan = await planService.remapCoordinates(
        req.params.plan_id,
        body.mapping as never,
        body.kind === 'boundary' ? 'boundary' : 'coordinates',
        ownerOptions(req),
    );
    sendSuccess(res, plan);
});

/**
 * A signed, expiring link to this plan's last drawing.
 *
 * ownerOptions carries the user filter, so a plan belonging to someone else is
 * not found rather than refused -- which also means this cannot be used to
 * discover whose plan an id belongs to.
 */
export const downloadPlanController = catchAsync(async (req: Request, res: Response) => {
    const result = await planService.getPlanDownloadUrl(
        req.params.plan_id,
        ownerOptions(req),
    );
    sendSuccess(res, result);
});

/**
 * Download every coordinate on a plan as CSV.
 *
 * Written straight to the response as it is read, so a survey of any size
 * costs the same memory here as a small one. The table in the app shows only
 * a preview and exporting that was exporting the preview.
 */
export const exportCoordinatesController = catchAsync(async (req: Request, res: Response) => {
    const kind = req.query.kind === 'boundary' ? 'boundary' : 'coordinates';
    const options = ownerOptions(req);

    // Resolved before any output: once the first chunk is written the status
    // and headers are sent, and a failure after that cannot be reported.
    const fileName = await planService.coordinatesCsvName(req.params.plan_id, options);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    for await (const chunk of planService.streamCoordinatesCsv(
        req.params.plan_id, kind, options,
    )) {
        // Wait when the socket is full rather than buffering the whole survey
        // in this process.
        if (!res.write(chunk)) {
            await new Promise(resolve => res.once('drain', resolve));
        }
    }
    res.end();
});

export const uploadCoordinatesController = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as Record<string, string>;

    let mapping;
    if (query.mapping) {
        try {
            mapping = JSON.parse(query.mapping);
        } catch {
            throw ApiError.badRequest('mapping must be JSON');
        }
    }

    const result = await planService.receiveCoordinateUpload(
        req.params.plan_id,
        req,
        {
            fileName: query.file_name,
            kind: query.kind === 'boundary' ? 'boundary' : 'coordinates',
            mapping,
            maxRows: query.max_rows ? Number(query.max_rows) : undefined,
            declaredBytes: req.headers['content-length']
                ? Number(req.headers['content-length'])
                : undefined,
        },
        String((req as any).user?.id ?? (req as any).user?._id ?? ''),
        ownerOptions(req),
    );

    // 202 for a queued upload, so the client can tell "stored" from "will be
    // stored" without inspecting the body.
    if (result.job) {
        res.status(202);
        sendSuccess(res, { job: result.job });
        return;
    }
    sendSuccess(res, result.plan);
});

export const inspectCadUploadController = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
        throw ApiError.badRequest('No file was uploaded');
    }
    const result = await planService.inspectCadUpload(body, req.headers['content-type'] ?? '');
    sendSuccess(res, result);
});

export const generatePlanController = catchAsync(async (req: Request, res: Response) => {
    const result = await planService.generatePlan(req.params.plan_id, req.user!.id, ownerOptions(req));
    // 202 when the work was queued: the caller has a job id to poll, not a plan.
    sendSuccess(res, result, undefined, result.job ? 202 : 200);
});

export const planJobStatusController = catchAsync(async (req: Request, res: Response) => {
    const job = await planJobs.getJob(req.params.job_id);
    if (!job || job.user !== req.user!.id) {
        throw ApiError.notFound('Job not found');
    }
    sendSuccess(res, job);
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
