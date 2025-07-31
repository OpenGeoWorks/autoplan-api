export const flattenObjectKeys = (obj: Record<string, any>, parentKey: string = ''): string[] => {
    let result: string[] = [];

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const fullPath = parentKey ? `${parentKey}.${key}` : key;

            if (typeof obj[key] === 'object' && obj[key] !== null) {
                result = result.concat(flattenObjectKeys(obj[key], fullPath));
            } else {
                result.push(fullPath);
            }
        }
    }

    return result;
};

export const setObjectValueByFlattenedKey = (obj: Record<string, any>, flattenedKey: string, newValue: any): void => {
    const keys = flattenedKey.split('.');
    let current: Record<string, any> = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!Object.prototype.hasOwnProperty.call(current, key)) {
            current[key] = {};
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = newValue;
};
