/* tslint:disable */
/* eslint-disable */

/**
 * WASM-exposed AST handle wrapping the context and cached analysis results.
 */
export class WasmAST {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Run the full analysis pipeline and return all results as JSON.
     * Config JSON: { "compilerVersion"?: string, "maxLoopIters"?: number,
     *               "maxPaths"?: number, "maxInlineDepth"?: number,
     *               "inlineCalls"?: bool, "checkFeasibility"?: bool }
     * Analyze a single contract by name. Includes inherited functions.
     * Returns the same JSON shape as the old analyzeAll but scoped to one contract.
     */
    analyzeContract(contract_name: string, config_json: string): string;
    /**
     * Get the CFG for a specific function.
     * Returns JSON: { functionId, functionName, blocks: [{id, stmts: [string], terminator}],
     *                 entry, exits: [id], reverts: [id], edges: [{from, to, label}] }
     */
    getCFG(func_id: bigint): string | undefined;
    /**
     * Get the call graph. Builds it if not cached.
     * Returns JSON: { nodes: [{id, name, contractName}], edges: [{from, to, callSite, isExternal}],
     *                 recursiveFunctions: [id] }
     */
    getCallGraph(): string;
    /**
     * Get the children IDs of a node.
     */
    getChildren(id: bigint): BigInt64Array;
    /**
     * Get a structured list of all contracts, their functions, state vars, events, etc.
     * Excludes contracts from test directories (test/, tests/, mock/, mocks/).
     * Returns JSON string.
     */
    getContractList(): string;
    /**
     * Get a composite CFG showing a function with its internal callees inlined.
     * Returns JSON: { rootFunction: { id, name, blocks, edges },
     *                 inlinedCallees: [{ callSite, callee: { id, name, blocks, edges }, parentBlock }],
     *                 crossEdges: [{ from, to, label }] }
     */
    getInlinedCFG(func_id: bigint): string | undefined;
    /**
     * Get a node serialized as JSON.
     */
    getNodeJSON(id: bigint): string | undefined;
    /**
     * Get a node's type string by ID.
     */
    getNodeType(id: bigint): string | undefined;
    /**
     * Get the parent ID of a node (-1 if root).
     */
    getParent(id: bigint): bigint;
    /**
     * Get detailed path info for a specific function's paths.
     * Returns JSON: [{index, exit, feasible, statements: [{text, type, ranges}], arithChecks: [...], ...}]
     * This is called on-demand when the user views a specific function's paths.
     */
    getPathDetail(func_id: bigint): string | undefined;
    /**
     * Get all source unit node IDs.
     */
    getSourceUnits(): BigInt64Array;
    /**
     * Get the state variable read/write map.
     * Returns JSON: [{varId, varName, typeString, contractId, contractName,
     *                 readers: [{funcId, funcName, contractName}],
     *                 writers: [{funcId, funcName, contractName}]}]
     */
    getStateVarAccess(): string;
    /**
     * Check if a node exists.
     */
    hasNode(id: bigint): boolean;
    /**
     * Parse a JSON string (build-info or standard output) into an AST.
     */
    constructor(json_str: string);
    /**
     * Get total number of nodes in the context.
     */
    nodeCount(): number;
    /**
     * Write a node back to Solidity source code.
     */
    writeNode(id: bigint): string;
    /**
     * Write a node back to Solidity source with line-level source mapping.
     *
     * Returns JSON: `{ "source": "...", "lineMap": [[line, col, nodeId], ...] }`
     * where line/col are 1-based and nodeId is the AST node covering that position.
     */
    writeNodeWithMapping(id: bigint): string;
    /**
     * Write a full source unit back to Solidity source code.
     */
    writeSourceUnit(id: bigint): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmast_free: (a: number, b: number) => void;
    readonly wasmast_analyzeContract: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly wasmast_getCFG: (a: number, b: number, c: bigint) => void;
    readonly wasmast_getCallGraph: (a: number, b: number) => void;
    readonly wasmast_getChildren: (a: number, b: number, c: bigint) => void;
    readonly wasmast_getContractList: (a: number, b: number) => void;
    readonly wasmast_getInlinedCFG: (a: number, b: number, c: bigint) => void;
    readonly wasmast_getNodeJSON: (a: number, b: number, c: bigint) => void;
    readonly wasmast_getNodeType: (a: number, b: number, c: bigint) => void;
    readonly wasmast_getParent: (a: number, b: bigint) => bigint;
    readonly wasmast_getPathDetail: (a: number, b: number, c: bigint) => void;
    readonly wasmast_getSourceUnits: (a: number, b: number) => void;
    readonly wasmast_getStateVarAccess: (a: number, b: number) => void;
    readonly wasmast_hasNode: (a: number, b: bigint) => number;
    readonly wasmast_new: (a: number, b: number, c: number) => void;
    readonly wasmast_nodeCount: (a: number) => number;
    readonly wasmast_writeNode: (a: number, b: number, c: bigint) => void;
    readonly wasmast_writeNodeWithMapping: (a: number, b: number, c: bigint) => void;
    readonly wasmast_writeSourceUnit: (a: number, b: number, c: bigint) => void;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number, b: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
