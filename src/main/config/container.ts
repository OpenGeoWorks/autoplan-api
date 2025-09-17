import { WinstonLoggerAdapter } from '@infra/winston/winston';
import { Logger } from '@domain/types/Common';
import { DbConnection } from '@infra/mongodb/db-connection';
import { RedisConnection } from '@infra/redis/client';
import { BcryptAdapter } from '@infra/cryptography/BcryptAdapter';
import { CryptAdapter } from '@infra/cryptography/CryptAdapter';
import { JWTAdapter } from '@infra/cryptography/JWTAdapter';
import { Crypt } from '@domain/interfaces/cryptography/Crypt';
import { ValidatorJS } from '@infra/validatorjs/validator';
import { UserRepo } from '@adapters/repositories/UserRepo';
import { Login } from '@use-cases/auth/Login';
import { UserRepositoryInterface } from '@domain/interfaces/repositories/UserRepositoryInterface';
import { OTPCache } from '@adapters/cache/OTPCache';
import { TokenCache } from '@adapters/cache/TokenCache';
import { OTPCacheInterface } from '@domain/interfaces/cache/OTPCacheInterface';
import { TokenCacheInterface } from '@domain/interfaces/cache/TokenCacheInterface';
import { Authenticate } from '@use-cases/auth/Authenticate';
import { Logout } from '@use-cases/auth/Logout';
import { SendLoginOTP } from '@use-cases/auth/SendLoginOTP';
import { EmailServiceInterface } from '@domain/interfaces/services/EmailServiceInterface';
import { AuthController } from '@adapters/controllers/AuthController';
import { Hash } from '@domain/interfaces/cryptography/Hash';
import { JWT } from '@domain/interfaces/cryptography/JWT';
import { UserController } from '@adapters/controllers/UserController';
import { SetProfile } from '@use-cases/user/SetProfile';
import { ProjectRepo } from '@adapters/repositories/ProjectRepo';
import { CreateProject } from '@use-cases/project/CreateProject';
import { ProjectRepositoryInterface } from '@domain/interfaces/repositories/ProjectRepositoryInterface';
import { EditProject } from '@use-cases/project/EditProject';
import { DeleteProject } from '@use-cases/project/DeleteProject';
import { ProjectController } from '@adapters/controllers/ProjectController';
import { BackComputation } from '@use-cases/traversing/BackComputation';
import { ForwardComputation } from '@use-cases/traversing/ForwardComputation';
import { TraverseController } from '@adapters/controllers/TraverseController';
import { PlanRepo } from '@adapters/repositories/PlanRepo';
import { CreatePlan } from '@use-cases/plan/CreatePlan';
import { PlanRepositoryInterface } from '@domain/interfaces/repositories/PlanRepositoryInterface';
import { DeletePlan } from '@use-cases/plan/DeletePlan';
import { EditCoordinates } from '@use-cases/plan/EditCoordinates';
import { EditParcels } from '@use-cases/plan/EditParcels';
import { EditPlan } from '@use-cases/plan/EditPlan';
import { PlanController } from '@adapters/controllers/PlanController';
import { TraverseComputation } from '@use-cases/traversing/TraverseComputation';
import { AreaComputation } from '@use-cases/traversing/AreaComputation';
import { EditTraverseComputation } from '@use-cases/plan/EditTraverseComputation';
import { EditForwardComputation } from '@use-cases/plan/EditForwardComputation';
import { SES } from '@infra/ses/ses';
import { GeneratePlan } from '@use-cases/plan/GeneratePlan';
import { EditElevation } from '@use-cases/plan/EditElevation';
import { DifferentialLeveling } from '@use-cases/leveling/DifferentialLeveling';
import { LevelingController } from '@adapters/controllers/LevelingController';

export class Container {
    private instances = new Map<string, any>();
    private factories = new Map<string, () => any>();

    register<T>(token: string, factory: () => T): void {
        this.factories.set(token, factory);
    }

    registerInstance<T>(token: string, instance: T): void {
        this.instances.set(token, instance);
    }

    resolve<T>(token: string): T {
        // Return cached instance if exists
        if (this.instances.has(token)) {
            return this.instances.get(token);
        }

        // Create new instance using factory
        const factory = this.factories.get(token);
        if (!factory) {
            throw new Error(`No factory registered for token: ${token}`);
        }

        const instance = factory();
        this.instances.set(token, instance);
        return instance;
    }

    clear(): void {
        this.instances.clear();
        this.factories.clear();
    }
}

export function setupContainer(): Container {
    const container = new Container();

    // Register Logger
    container.register<Logger>('Logger', () => new WinstonLoggerAdapter());

    // Register Database
    container.register('Database', () => {
        return DbConnection.getInstance(container.resolve<Logger>('Logger'));
    });

    // Register Cache
    container.register('Cache', () => {
        return RedisConnection.getInstance(container.resolve<Logger>('Logger'));
    });

    // Register services
    container.register('Hash', () => new BcryptAdapter(10));
    container.register('Crypt', () => CryptAdapter.getInstance());
    container.register('JWT', () => JWTAdapter.getInstance(container.resolve<Crypt>('Crypt')));
    container.register('Email', () => SES.getInstance(container.resolve<Logger>('Logger')));
    container.register('Validator', () => new ValidatorJS());

    // Register Repositories
    container.register('UserRepo', () => {
        return new UserRepo(container.resolve<Logger>('Logger'));
    });
    container.register('ProjectRepo', () => {
        return new ProjectRepo(container.resolve<Logger>('Logger'));
    });
    container.register('PlanRepo', () => {
        return new PlanRepo(container.resolve<Logger>('Logger'));
    });

    // Register Caches
    container.register('OTPCache', () => {
        return new OTPCache(container.resolve<Logger>('Logger'), container.resolve<RedisConnection>('Cache'));
    });
    container.register('TokenCache', () => {
        return new TokenCache(container.resolve<Logger>('Logger'), container.resolve<RedisConnection>('Cache'));
    });

    // Register UseCases
    container.register('LoginUseCase', () => {
        return new Login(
            container.resolve<Logger>('Logger'),
            container.resolve<UserRepositoryInterface>('UserRepo'),
            container.resolve<OTPCacheInterface>('OTPCache'),
            container.resolve<TokenCacheInterface>('TokenCache'),
            container.resolve<Hash>('Hash'),
            container.resolve<JWT>('JWT'),
        );
    });
    container.register('AuthenticateUseCase', () => {
        return new Authenticate(
            container.resolve<Logger>('Logger'),
            container.resolve('JWT'),
            container.resolve<TokenCacheInterface>('TokenCache'),
        );
    });
    container.register('LogoutUseCase', () => {
        return new Logout(container.resolve<Logger>('Logger'), container.resolve<TokenCacheInterface>('TokenCache'));
    });
    container.register('SendLoginOTPUseCase', () => {
        return new SendLoginOTP(
            container.resolve<Logger>('Logger'),
            container.resolve<UserRepositoryInterface>('UserRepo'),
            container.resolve<OTPCacheInterface>('OTPCache'),
            container.resolve<EmailServiceInterface>('Email'),
            container.resolve<Hash>('Hash'),
        );
    });
    container.register('SetProfileUseCase', () => {
        return new SetProfile(
            container.resolve<Logger>('Logger'),
            container.resolve<UserRepositoryInterface>('UserRepo'),
        );
    });
    container.register('CreateProjectUseCase', () => {
        return new CreateProject(
            container.resolve<Logger>('Logger'),
            container.resolve<ProjectRepositoryInterface>('ProjectRepo'),
        );
    });
    container.register('EditProjectUseCase', () => {
        return new EditProject(
            container.resolve<Logger>('Logger'),
            container.resolve<ProjectRepositoryInterface>('ProjectRepo'),
        );
    });
    container.register('DeleteProjectUseCase', () => {
        return new DeleteProject(
            container.resolve<Logger>('Logger'),
            container.resolve<ProjectRepositoryInterface>('ProjectRepo'),
        );
    });
    container.register('AreaComputationUseCase', () => {
        return new AreaComputation(container.resolve<Logger>('Logger'));
    });
    container.register('BackComputationUseCase', () => {
        return new BackComputation(container.resolve<Logger>('Logger'), container.resolve('AreaComputationUseCase'));
    });
    container.register('ForwardComputationUseCase', () => {
        return new ForwardComputation(container.resolve<Logger>('Logger'));
    });
    container.register('TraverseComputationUseCase', () => {
        return new TraverseComputation(
            container.resolve<Logger>('Logger'),
            container.resolve('ForwardComputationUseCase'),
            container.resolve('BackComputationUseCase'),
        );
    });
    container.register('CreatePlanUseCase', () => {
        return new CreatePlan(
            container.resolve<Logger>('Logger'),
            container.resolve<ProjectRepositoryInterface>('ProjectRepo'),
            container.resolve<PlanRepositoryInterface>('PlanRepo'),
        );
    });
    container.register('DeletePlanUseCase', () => {
        return new DeletePlan(
            container.resolve<Logger>('Logger'),
            container.resolve<PlanRepositoryInterface>('PlanRepo'),
        );
    });
    container.register('EditCoordinateUseCase', () => {
        return new EditCoordinates(
            container.resolve<Logger>('Logger'),
            container.resolve<PlanRepositoryInterface>('PlanRepo'),
        );
    });
    container.register('EditParcelUseCase', () => {
        return new EditParcels(
            container.resolve<Logger>('Logger'),
            container.resolve<PlanRepositoryInterface>('PlanRepo'),
        );
    });
    container.register('EditPlanUseCase', () => {
        return new EditPlan(
            container.resolve<Logger>('Logger'),
            container.resolve<PlanRepositoryInterface>('PlanRepo'),
        );
    });
    container.register('EditTraverseComputationUseCase', () => {
        return new EditTraverseComputation(
            container.resolve<Logger>('Logger'),
            container.resolve<PlanRepositoryInterface>('PlanRepo'),
        );
    });
    container.register('EditForwardComputationUseCase', () => {
        return new EditForwardComputation(
            container.resolve<Logger>('Logger'),
            container.resolve<PlanRepositoryInterface>('PlanRepo'),
        );
    });
    container.register('GeneratePlanUseCase', () => {
        return new GeneratePlan(
            container.resolve<Logger>('Logger'),
            container.resolve<PlanRepositoryInterface>('PlanRepo'),
            container.resolve('BackComputationUseCase'),
        );
    });
    container.register('EditElevationUseCase', () => {
        return new EditElevation(
            container.resolve<Logger>('Logger'),
            container.resolve<PlanRepositoryInterface>('PlanRepo'),
        );
    });
    container.register('DifferentialLevelingUseCase', () => {
        return new DifferentialLeveling(container.resolve<Logger>('Logger'));
    });

    // Register Controllers
    container.register('AuthController', () => {
        const logger = container.resolve<Logger>('Logger');
        return new AuthController(
            logger,
            container.resolve('LoginUseCase'),
            container.resolve('LogoutUseCase'),
            container.resolve('SendLoginOTPUseCase'),
            container.resolve('AuthenticateUseCase'),
        );
    });
    container.register('UserController', () => {
        const logger = container.resolve<Logger>('Logger');
        return new UserController(
            logger,
            container.resolve('SetProfileUseCase'),
            container.resolve<UserRepositoryInterface>('UserRepo'),
        );
    });
    container.register('ProjectController', () => {
        const logger = container.resolve<Logger>('Logger');
        return new ProjectController(
            logger,
            container.resolve<ProjectRepositoryInterface>('ProjectRepo'),
            container.resolve('CreateProjectUseCase'),
            container.resolve('EditProjectUseCase'),
            container.resolve('DeleteProjectUseCase'),
        );
    });
    container.register('TraverseController', () => {
        const logger = container.resolve<Logger>('Logger');
        return new TraverseController(
            logger,
            container.resolve('BackComputationUseCase'),
            container.resolve('ForwardComputationUseCase'),
            container.resolve('TraverseComputationUseCase'),
        );
    });
    container.register('LevelingController', () => {
        const logger = container.resolve<Logger>('Logger');
        return new LevelingController(logger, container.resolve('DifferentialLevelingUseCase'));
    });
    container.register('PlanController', () => {
        const logger = container.resolve<Logger>('Logger');
        return new PlanController(
            logger,
            container.resolve<PlanRepositoryInterface>('PlanRepo'),
            container.resolve('CreatePlanUseCase'),
            container.resolve('DeletePlanUseCase'),
            container.resolve('EditCoordinateUseCase'),
            container.resolve('EditParcelUseCase'),
            container.resolve('EditPlanUseCase'),
            container.resolve('EditTraverseComputationUseCase'),
            container.resolve('EditForwardComputationUseCase'),
            container.resolve('GeneratePlanUseCase'),
            container.resolve('EditElevationUseCase'),
        );
    });

    return container;
}
