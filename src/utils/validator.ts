import Validator, { Errors, register, Rules } from 'validatorjs';
import { phone } from 'phone';
import moment from 'moment';
import { ApiError } from '@utils/api-error';

/**
 * validatorjs wrapper with two extra behaviours:
 *  - unknown fields are rejected (strict payloads)
 *  - numeric-typed fields are coerced from strings before validation
 */

const flattenObjectKeys = (obj: Record<string, unknown>, parentKey = ''): string[] => {
    let result: string[] = [];
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const fullPath = parentKey ? `${parentKey}.${key}` : key;
            const value = obj[key];
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                result = result.concat(flattenObjectKeys(value as Record<string, unknown>, fullPath));
            } else {
                result.push(fullPath);
            }
        }
    }
    return result;
};

const setObjectValueByFlattenedKey = (obj: Record<string, unknown>, flattenedKey: string, newValue: unknown): void => {
    const keys = flattenedKey.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!Object.prototype.hasOwnProperty.call(current, key)) {
            current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = newValue;
};

class ValidatorJS {
    constructor() {
        this.registerCustomRules();
    }

    private hasRule(rules: Rules, attribute: string, findRules: string[]): boolean {
        const attrRules = (rules[attribute] as unknown as { name: string }[]) || [];
        return attrRules.some(r => findRules.includes(r.name));
    }

    private hasNumericRule(rules: Rules, attribute: string): boolean {
        return this.hasRule(rules, attribute, ['integer', 'numeric']);
    }

    private objectPath(obj: Record<string, unknown>, path: string): unknown {
        if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];

        const keys = path
            .replace(/\[(\w+)\]/g, '.$1')
            .replace(/^\./, '')
            .split('.');

        let current: unknown = obj;
        for (const key of keys) {
            if (typeof current === 'object' && current !== null && Object.prototype.hasOwnProperty.call(current, key)) {
                current = (current as Record<string, unknown>)[key];
            } else {
                return undefined;
            }
        }
        return current;
    }

    private innerValidate(
        data: Record<string, unknown>,
        rules: Rules,
        cb: (errors: Errors | null, status: boolean) => void,
    ): void {
        const validator = new Validator(data, rules);
        const bodyKeys = flattenObjectKeys({ ...data });

        for (const key of bodyKeys) {
            if (validator.rules[key] === undefined) {
                // Allow unknown nested keys when the parent is declared as an
                // array (array element rules live under `parent.*`) or has an
                // empty rule set (free-form objects such as `profile`).
                const parentRule = key.split('.').slice(0, -1).join('.');
                if (
                    validator.rules[parentRule] !== undefined &&
                    (this.hasRule(validator.rules, parentRule, ['array']) ||
                        JSON.stringify(validator.rules[parentRule]) === JSON.stringify([]))
                ) {
                    continue;
                }
                validator.errors.add(key, `The ${key} field is not allowed.`);
                cb(validator.errors, false);
                return;
            }

            if (this.hasNumericRule(validator.rules, key)) {
                const value = this.objectPath(data, key);
                if (value !== undefined && value !== null && value !== '') {
                    if (isNaN(Number(value))) {
                        validator.errors.add(key, `The ${key} field must be a number.`);
                        cb(validator.errors, false);
                        return;
                    } else {
                        setObjectValueByFlattenedKey(data, key, Number(value));
                    }
                }
            }
        }

        validator.passes(() => cb(null, true));
        validator.fails(() => cb(validator.errors, false));
    }

    private registerCustomRules(): void {
        register(
            'json',
            (value: unknown) => {
                try {
                    JSON.parse(value as string);
                    return true;
                } catch {
                    return false;
                }
            },
            'The :attribute must be a valid JSON string.',
        );

        register(
            'phone',
            (value: unknown) => phone(value as string).isValid,
            'Invalid phone number, please provide a number in international format.',
        );

        register(
            'date_format',
            (value: unknown, requirement: string) => moment(value as string, requirement, true).isValid(),
            'The :attribute does not match the correct format.',
        );
    }

    /** Validate `data` against `rules`; throws ApiError(400) with the first failure. */
    validate(data: Record<string, unknown>, rules: Rules): void {
        this.innerValidate(data ?? {}, rules, (errs, status) => {
            if (!status) {
                const firstKey = Object.keys(errs?.errors ?? {})[0];
                const firstError = errs?.errors[firstKey]?.[0];
                throw ApiError.badRequest(firstError ?? 'Validation failed');
            }
        });
    }
}

export default new ValidatorJS();
