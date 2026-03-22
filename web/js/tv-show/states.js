/**
 * State registry to avoid circular import issues between TV show states.
 */
const stateRegistry = {};

export function registerState(name, stateClass) {
    stateRegistry[name] = stateClass;
}

export function getState(name) {
    return stateRegistry[name];
}
