import { Child2 } from './child2.mjs';

export const Child1 = async () => {
    try {
        const v = await Child2()
    } catch (e) {
        throw new Error(e)
    }

    return '6666'
}
