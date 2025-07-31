import Validator, { Errors, register, Rules } from 'validatorjs';
import phone from 'phone';
import moment from 'moment';
import { flattenObjectKeys, setObjectValueByFlattenedKey } from './utils';

export class ValidatorJS {
    constructor() {
        this.registerCustomRules();
    }

    _hasRule(rules: Rules, attribute: string, findRules: string[]): boolean {
        let rules_ = rules[attribute] || [];
        for (let i = 0, len = rules_.length; i < <number>len; i++) {
            // @ts-ignore
            if (findRules.indexOf(rules_[i].name) > -1) {
                return true;
            }
        }
        return false;
    }

    _hasNumericRule(rules: Rules, attribute: string): boolean {
        return this._hasRule(rules, attribute, ['integer', 'numeric']);
    }

    _objectPath(obj: Record<string, any>, path: string): any | void {
        if (Object.prototype.hasOwnProperty.call(obj, path)) {
            return obj[path];
        }

        let keys = path
            .replace(/\[(\w+)\]/g, '.$1')
            .replace(/^\./, '')
            .split('.');
        let copy: Record<string, any> = {};
        for (let attr in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, attr)) {
                copy[attr] = obj[attr];
            }
        }

        for (let i = 0, l = keys.length; i < l; i++) {
            if (typeof copy === 'object' && copy !== null && Object.hasOwnProperty.call(copy, keys[i])) {
                copy = copy[keys[i]];
            } else {
                return;
            }
        }
        return copy;
    }

    innerValidate(
        data: Record<string, any>,
        rules: Record<string, any>,
        cb: (errors: Errors | null, status: boolean) => void,
    ): void {
        const validator = new Validator(data, rules);
        const bodyKeys = flattenObjectKeys({ ...data });

        for (const key of bodyKeys) {
            if (validator.rules[key] === undefined) {
                // Some checks
                const rule = key.split('.').slice(0, -1).join('.');
                if (validator.rules[rule] !== undefined) {
                    if (
                        this._hasRule(validator.rules, rule, ['array']) ||
                        JSON.stringify(validator.rules[rule]) === JSON.stringify([])
                    ) {
                        continue;
                    }
                }
                validator.errors.add(key, `The ${key} field is not allowed.`);
                cb(validator.errors, false);
                return;
            }

            // Check for numeric rule
            if (this._hasNumericRule(validator.rules, key)) {
                const value = this._objectPath(data, key);
                if (value !== undefined && value !== null && value !== '') {
                    if (isNaN(value)) {
                        validator.errors.add(key, `The ${key} field must be a number.`);
                        cb(validator.errors, false);
                        return;
                    } else {
                        setObjectValueByFlattenedKey(data, key, Number(value));
                    }
                }
            }
        }

        // Callbacks for pass/fail
        validator.passes(() => cb(null, true));
        validator.fails(() => cb(validator.errors, false));
    }

    // Register custom validation rules
    registerCustomRules(): void {
        // JSON validation rule
        register(
            'json',
            (value: any) => {
                try {
                    JSON.parse(value);
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'The :attribute must be a valid JSON string.',
        );

        // Phone number validation rule
        register(
            'phone',
            (value: any) => {
                const isPhoneValid = phone(value);
                return isPhoneValid.isValid;
            },
            'Invalid phone number provided, please provide a phone number in the international format.',
        );

        // Date format validation rule
        register(
            'date_format',
            (value: any, requirement: string) => {
                return moment(value, requirement, true).isValid();
            },
            'The :attribute does not match the correct format.',
        );
    }

    validate(data: Record<string, any>, rules: Record<string, any>): void {
        this.innerValidate(data, rules, (errs, status) => {
            if (!status) {
                const firstError = errs?.errors[Object.keys(errs?.errors)[0]][0];
                throw new Error(firstError);
            }
        });
    }
}

export default new ValidatorJS();
