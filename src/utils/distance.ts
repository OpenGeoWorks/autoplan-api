export function calculateDistance(from: number, to: number): number {
    // calculate the distance between two points using the Pythagorean theorem
    return Math.sqrt(Math.pow(to, 2) + Math.pow(from, 2));
}
