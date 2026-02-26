/// Web Worker: loads WASM module and handles all analysis calls off the main thread.
/// Handles bigint <-> number conversion at the boundary (WASM uses i64 = bigint).

import * as Comlink from 'comlink';
import init, { WasmAST } from '../wasm/solc_ast_rs';

let initialized = false;
let ast: WasmAST | null = null;

const api = {
  async init() {
    if (!initialized) {
      await init();
      initialized = true;
    }
  },

  async loadFile(jsonStr: string): Promise<{ nodeCount: number; sourceUnits: number[] }> {
    await this.init();
    ast = new WasmAST(jsonStr);
    return {
      nodeCount: ast.nodeCount(),
      sourceUnits: Array.from(ast.getSourceUnits(), Number),
    };
  },

  getContractList(): string {
    if (!ast) throw new Error('No AST loaded');
    return ast.getContractList();
  },

  analyzeContract(contractName: string, configJson: string): string {
    if (!ast) throw new Error('No AST loaded');
    return ast.analyzeContract(contractName, configJson);
  },

  getCallGraph(): string {
    if (!ast) throw new Error('No AST loaded');
    return ast.getCallGraph();
  },

  getCFG(funcId: number): string | undefined {
    if (!ast) throw new Error('No AST loaded');
    return ast.getCFG(BigInt(funcId));
  },

  getPathDetail(funcId: number): string | undefined {
    if (!ast) throw new Error('No AST loaded');
    return ast.getPathDetail(BigInt(funcId));
  },

  getStateVarAccess(): string {
    if (!ast) throw new Error('No AST loaded');
    return ast.getStateVarAccess();
  },

  writeSourceUnit(id: number): string {
    if (!ast) throw new Error('No AST loaded');
    return ast.writeSourceUnit(BigInt(id));
  },

  writeNode(id: number): string {
    if (!ast) throw new Error('No AST loaded');
    return ast.writeNode(BigInt(id));
  },

  writeNodeWithMapping(id: number): string {
    if (!ast) throw new Error('No AST loaded');
    return ast.writeNodeWithMapping(BigInt(id));
  },

  getInlinedCFG(funcId: number): string | undefined {
    if (!ast) throw new Error('No AST loaded');
    return ast.getInlinedCFG(BigInt(funcId));
  },

  getNodeType(id: number): string | undefined {
    if (!ast) throw new Error('No AST loaded');
    return ast.getNodeType(BigInt(id));
  },

  nodeCount(): number {
    if (!ast) throw new Error('No AST loaded');
    return ast.nodeCount();
  },
};

export type WorkerAPI = typeof api;
Comlink.expose(api);
