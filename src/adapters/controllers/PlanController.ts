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
import { Plan } from '@domain/entities/Plan';
import { badRequest, handleError, noContent, notFound, success } from '@adapters/controllers/helpers/http';
import { PlanValidator } from '@adapters/validators/PlanValidator';
import { parseQuery } from '@adapters/controllers/helpers/query';

export class PlanController {
    constructor(
        private readonly logger: Logger,
        private readonly planRepo: PlanRepositoryInterface,
        private readonly createPlanUseCase: CreatePlan,
        private readonly deletePlanUseCase: DeletePlan,
        private readonly editCoordinatesUseCase: EditCoordinates,
        private readonly editParcelUseCase: EditParcels,
        private readonly editPlanUseCase: EditPlan,
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
}
