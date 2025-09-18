import { Logger, RepoOptions } from '@domain/types/Common';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import { CreatePlan, CreatePlanRequest } from '@use-cases/plan/CreatePlan';
import { DeletePlan } from '@use-cases/plan/DeletePlan';
import { EditCoordinates, EditCoordinatesRequest } from '@use-cases/plan/EditCoordinates';
import { EditParcels, EditParcelsRequest } from '@use-cases/plan/EditParcels';
import { EditPlan, EditPlanRequest } from '@use-cases/plan/EditPlan';
import { HttpRequest } from '@adapters/controllers/interfaces/HttpRequest';
import { AuthenticateResponse } from '@use-cases/auth/Authenticate';
import { HttpResponse } from '@adapters/controllers/interfaces/HttpResponse';
import { BeaconType, PageOrientation, PageSize, Plan, PlanOrigin } from '@domain/entities/Plan';
import { badRequest, handleError, noContent, notFound, success } from '@adapters/controllers/helpers/http';
import { PlanValidator } from '@adapters/validators/PlanValidator';
import { parseQuery } from '@adapters/controllers/helpers/query';
import { EditTraverseComputation, EditTraverseComputationRequest } from '@use-cases/plan/EditTraverseComputation';
import { EditForwardComputation, EditForwardComputationRequest } from '@use-cases/plan/EditForwardComputation';
import { GeneratePlan, GeneratePlanResponse } from '@use-cases/plan/GeneratePlan';
import { EditElevation, EditElevationRequest } from '@use-cases/plan/EditElevation';
import { EditDifferentialLeveling, EditDifferentialLevelingRequest } from '@use-cases/plan/EditDifferentialLeveling';
import { EditTopoBoundary, EditTopoBoundaryRequest } from '@use-cases/plan/EditTopoBoundary';
import { EditTopoSetting, EditTopoSettingRequest } from '@use-cases/plan/EditTopoSetting';

export class PlanController {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
        private readonly createPlanUseCase: CreatePlan,
        private readonly deletePlanUseCase: DeletePlan,
        private readonly editCoordinatesUseCase: EditCoordinates,
        private readonly editParcelUseCase: EditParcels,
        private readonly editPlanUseCase: EditPlan,
        private readonly editTraverseComputationUseCase: EditTraverseComputation,
        private readonly editForwardComputationUseCase: EditForwardComputation,
        private readonly generatePlanUseCase: GeneratePlan,
        private readonly editElevationsUseCase: EditElevation,
        private readonly editDifferentialLevelingUseCase: EditDifferentialLeveling,
        private readonly editTopoBoundaryUseCase: EditTopoBoundary,
        private readonly editTopoSettingUseCase: EditTopoSetting,
    ) {}

    async createPlan(
        req: HttpRequest<CreatePlanRequest['plan'], undefined, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<Plan | Error>> {
        try {
            const error = PlanValidator.validateCreatePlan(req.body);
            if (error) {
                return badRequest(error);
            }

            const plan = await this.createPlanUseCase.execute({
                plan: req.body!,
                options: {
                    filter: { user: req.user!.id },
                },
            });

            return success(plan);
        } catch (e) {
            return handleError(e);
        }
    }

    async deletePlan(
        req: HttpRequest<undefined, { plan_id: string }, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<void | Error>> {
        try {
            await this.deletePlanUseCase.execute({
                id: req.params!.plan_id,
                options: {
                    filter: { user: req.user!.id },
                },
            });

            return noContent();
        } catch (e) {
            return handleError(e);
        }
    }

    async editCoordinates(
        req: HttpRequest<EditCoordinatesRequest, { plan_id: string }, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<Plan | Error>> {
        try {
            const error = PlanValidator.validateEditCoordinates(req.body);
            if (error) {
                return badRequest(error);
            }

            const plan = await this.editCoordinatesUseCase.execute({
                plan_id: req.params!.plan_id,
                coordinates: req.body!.coordinates,
                options: {
                    filter: { user: req.user!.id },
                    projection: {
                        coordinates: 1,
                        created_at: 1,
                        updated_at: 1,
                    },
                },
            });

            return success(plan);
        } catch (e) {
            return handleError(e);
        }
    }

    async editElevations(
        req: HttpRequest<EditElevationRequest, { plan_id: string }, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<Plan | Error>> {
        try {
            const error = PlanValidator.validateEditElevations(req.body);
            if (error) {
                return badRequest(error);
            }

            const plan = await this.editElevationsUseCase.execute({
                plan_id: req.params!.plan_id,
                elevations: req.body!.elevations,
                options: {
                    filter: { user: req.user!.id },
                    projection: {
                        elevations: 1,
                        created_at: 1,
                        updated_at: 1,
                    },
                },
            });

            return success(plan);
        } catch (e) {
            return handleError(e);
        }
    }

    async editParcels(
        req: HttpRequest<EditParcelsRequest, { plan_id: string }, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<Plan | Error>> {
        try {
            const error = PlanValidator.validateEditParcels(req.body);
            if (error) {
                return badRequest(error);
            }

            const plan = await this.editParcelUseCase.execute({
                plan_id: req.params!.plan_id,
                parcels: req.body!.parcels,
                options: {
                    filter: { user: req.user!.id },
                    projection: {
                        parcels: 1,
                        created_at: 1,
                        updated_at: 1,
                    },
                },
            });

            return success(plan);
        } catch (e) {
            return handleError(e);
        }
    }

    async editTraverseComputation(
        req: HttpRequest<
            EditTraverseComputationRequest['traverse_data'],
            { plan_id: string },
            undefined,
            undefined,
            AuthenticateResponse
        >,
    ): Promise<HttpResponse<Plan | Error>> {
        try {
            const error = PlanValidator.validateTraverseData(req.body);
            if (error) {
                return badRequest(error);
            }

            const plan = await this.editTraverseComputationUseCase.execute({
                plan_id: req.params!.plan_id,
                traverse_data: req.body!,
                options: {
                    filter: { user: req.user!.id },
                    projection: {
                        traverse_computation_data: 1,
                        created_at: 1,
                        updated_at: 1,
                    },
                },
            });

            return success(plan);
        } catch (e) {
            return handleError(e);
        }
    }

    async editForwardComputation(
        req: HttpRequest<
            EditForwardComputationRequest['forward_data'],
            { plan_id: string },
            undefined,
            undefined,
            AuthenticateResponse
        >,
    ): Promise<HttpResponse<Plan | Error>> {
        try {
            const error = PlanValidator.validateForwardData(req.body);
            if (error) {
                return badRequest(error);
            }

            const plan = await this.editForwardComputationUseCase.execute({
                plan_id: req.params!.plan_id,
                forward_data: req.body!,
                options: {
                    filter: { user: req.user!.id },
                    projection: {
                        forward_computation_data: 1,
                        created_at: 1,
                        updated_at: 1,
                    },
                },
            });

            return success(plan);
        } catch (e) {
            return handleError(e);
        }
    }

    async editDifferentialLeveling(
        req: HttpRequest<
            EditDifferentialLevelingRequest['leveling_data'],
            { plan_id: string },
            undefined,
            undefined,
            AuthenticateResponse
        >,
    ): Promise<HttpResponse<Plan | Error>> {
        try {
            const error = PlanValidator.validateDifferentialLevelingData(req.body);
            if (error) {
                return badRequest(error);
            }

            const plan = await this.editDifferentialLevelingUseCase.execute({
                plan_id: req.params!.plan_id,
                leveling_data: req.body!,
                options: {
                    filter: { user: req.user!.id },
                    projection: {
                        differential_leveling_data: 1,
                        created_at: 1,
                        updated_at: 1,
                    },
                },
            });

            return success(plan);
        } catch (e) {
            return handleError(e);
        }
    }

    async editPlan(
        req: HttpRequest<EditPlanRequest['plan'], { plan_id: string }, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<Plan | Error>> {
        try {
            const error = PlanValidator.validateEditPlan(req.body);
            if (error) {
                return badRequest(error);
            }

            const plan = await this.editPlanUseCase.execute({
                plan_id: req.params!.plan_id,
                plan: req.body!,
                options: {
                    filter: { user: req.user!.id },
                    projection: {
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
                        created_at: 1,
                        updated_at: 1,
                    },
                },
            });

            return success(plan);
        } catch (e) {
            return handleError(e);
        }
    }

    async listPlan(
        req: HttpRequest<undefined, { project_id: string }, undefined, Record<string, string>, AuthenticateResponse>,
    ): Promise<HttpResponse<Plan[] | Error>> {
        try {
            const repoOptions: RepoOptions = parseQuery(req.query!, ['type'], ['created_at', 'updated_at']);
            repoOptions.filter = repoOptions.filter ?? {};
            repoOptions.filter['user'] = req.user!.id;
            repoOptions.projection = {
                id: 1,
                name: 1,
                type: 1,
                created_at: 1,
                updated_at: 1,
            };

            const plans = await this.planRepo.listPlans(req.params!.project_id, repoOptions);

            return success(plans);
        } catch (e) {
            return handleError(e);
        }
    }

    async fetchPlan(
        req: HttpRequest<undefined, { plan_id: string }, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<Plan | Error>> {
        try {
            const plan = await this.planRepo.getPlanById(req.params!.plan_id, {
                filter: { user: req.user!.id },
            });

            if (!plan) {
                return notFound(new Error('Plan not found'));
            }

            return success(plan);
        } catch (e) {
            return handleError(e);
        }
    }

    async generatePlan(
        req: HttpRequest<undefined, { plan_id: string }, undefined, undefined, AuthenticateResponse>,
    ): Promise<HttpResponse<GeneratePlanResponse | Error>> {
        try {
            const res = await this.generatePlanUseCase.execute({
                plan_id: req.params!.plan_id,
                options: {
                    filter: { user: req.user!.id },
                },
            });

            return success(res);
        } catch (e) {
            return handleError(e);
        }
    }

    async editTopoBoundary(
        req: HttpRequest<
            EditTopoBoundaryRequest['boundary'],
            { plan_id: string },
            undefined,
            undefined,
            AuthenticateResponse
        >,
    ): Promise<HttpResponse<Plan | Error>> {
        try {
            const error = PlanValidator.validateEditTopoBoundary(req.body);
            if (error) {
                return badRequest(error);
            }

            const plan = await this.editTopoBoundaryUseCase.execute({
                plan_id: req.params!.plan_id,
                boundary: req.body!,
                options: {
                    filter: { user: req.user!.id },
                    projection: {
                        topographic_boundary: 1,
                        created_at: 1,
                        updated_at: 1,
                    },
                },
            });

            return success(plan);
        } catch (e) {
            return handleError(e);
        }
    }

    async editTopoSetting(
        req: HttpRequest<
            EditTopoSettingRequest['setting'],
            { plan_id: string },
            undefined,
            undefined,
            AuthenticateResponse
        >,
    ): Promise<HttpResponse<Plan | Error>> {
        try {
            const error = PlanValidator.validateEditTopoSetting(req.body);
            if (error) {
                return badRequest(error);
            }

            const plan = await this.editTopoSettingUseCase.execute({
                plan_id: req.params!.plan_id,
                setting: req.body!,
                options: {
                    filter: { user: req.user!.id },
                    projection: {
                        topographic_setting: 1,
                        created_at: 1,
                        updated_at: 1,
                    },
                },
            });

            return success(plan);
        } catch (e) {
            return handleError(e);
        }
    }
}
