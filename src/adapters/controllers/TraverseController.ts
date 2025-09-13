import { Logger } from '@domain/types/Common';
import {
    BackComputation,
    BackComputationRequest,
    BackComputationResponse,
} from '@use-cases/traversing/BackComputation';
import {
    ForwardComputation,
    ForwardComputationRequest,
    ForwardComputationResponse,
} from '@use-cases/traversing/ForwardComputation';
import { HttpRequest } from '@adapters/controllers/interfaces/HttpRequest';
import { HttpResponse } from '@adapters/controllers/interfaces/HttpResponse';
import { badRequest, handleError, success } from '@adapters/controllers/helpers/http';
import { TraverseValidator } from '@adapters/validators/TraverseValidator';
import {
    TraverseComputation,
    TraverseComputationRequest,
    TraverseComputationResponse,
} from '@use-cases/traversing/TraverseComputation';

export class TraverseController {
    constructor(
        private readonly logger: Logger,
        private readonly backComputationUseCase: BackComputation,
        private readonly forwardComputationUseCase: ForwardComputation,
        private readonly traverseComputationUseCase: TraverseComputation,
    ) {}

    async backComputation(
        req: HttpRequest<BackComputationRequest>,
    ): Promise<HttpResponse<BackComputationResponse | Error>> {
        try {
            const error = TraverseValidator.validateBackComputation(req.body);
            if (error) {
                return badRequest(error);
            }

            const result = await this.backComputationUseCase.execute(req.body!);
            return success(result);
        } catch (e) {
            return handleError(e);
        }
    }

    async forwardComputation(
        req: HttpRequest<ForwardComputationRequest>,
    ): Promise<HttpResponse<ForwardComputationResponse | Error>> {
        try {
            const error = TraverseValidator.validateForwardComputation(req.body);
            if (error) {
                return badRequest(error);
            }

            const result = await this.forwardComputationUseCase.execute(req.body!);
            return success(result);
        } catch (e) {
            return handleError(e);
        }
    }

    async traverseComputation(
        req: HttpRequest<TraverseComputationRequest>,
    ): Promise<HttpResponse<TraverseComputationResponse | Error>> {
        try {
            const error = TraverseValidator.validateTraverseComputation(req.body);
            if (error) {
                return badRequest(error);
            }

            const result = await this.traverseComputationUseCase.execute(req.body!);
            return success(result);
        } catch (e) {
            return handleError(e);
        }
    }
}
