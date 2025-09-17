import { Logger } from '@domain/types/Common';
import {
    DifferentialLeveling,
    DifferentialLevelingRequest,
    DifferentialLevelingResponse,
} from '@use-cases/leveling/DifferentialLeveling';
import { HttpRequest } from '@adapters/controllers/interfaces/HttpRequest';
import { HttpResponse } from '@adapters/controllers/interfaces/HttpResponse';
import { badRequest, handleError, success } from '@adapters/controllers/helpers/http';
import { LevelingValidator } from '@adapters/validators/LevelingValidators';

export class LevelingController {
    constructor(
        private readonly logger: Logger,
        private readonly differentialLevelingUseCase: DifferentialLeveling,
    ) {}

    async differentialLeveling(
        req: HttpRequest<DifferentialLevelingRequest>,
    ): Promise<HttpResponse<DifferentialLevelingResponse | Error>> {
        try {
            const error = LevelingValidator.validateDifferentialLeveling(req.body);
            if (error) {
                return badRequest(error);
            }

            const result = this.differentialLevelingUseCase.execute({ ...req.body!, round: true });
            return success(result);
        } catch (e) {
            return handleError(e);
        }
    }
}
