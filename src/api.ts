/// Typed async wrapper around the Web Worker (via comlink).

import * as Comlink from 'comlink';
import type { WorkerAPI } from './worker';
import type {
  ContractInfo,
  AnalysisResult,
  CallGraphData,
  CFGData,
  InlinedCFGData,
  StateVarAccess,
  PathInfo,
  SourceWithMapping,
} from './types';

let workerProxy: Comlink.Remote<WorkerAPI> | null = null;

function getWorker(): Comlink.Remote<WorkerAPI> {
  if (!workerProxy) {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerProxy = Comlink.wrap<WorkerAPI>(w);
  }
  return workerProxy;
}

export async function loadFile(jsonStr: string): Promise<{ nodeCount: number; sourceUnits: number[] }> {
  return getWorker().loadFile(jsonStr);
}

export async function getContractList(): Promise<ContractInfo[]> {
  const json = await getWorker().getContractList();
  return JSON.parse(json);
}

export async function analyzeContract(contractName: string, config: Record<string, unknown> = {}): Promise<AnalysisResult> {
  const json = await getWorker().analyzeContract(contractName, JSON.stringify(config));
  return JSON.parse(json);
}

export async function getCallGraph(): Promise<CallGraphData> {
  const json = await getWorker().getCallGraph();
  return JSON.parse(json);
}

export async function getCFG(funcId: number): Promise<CFGData | null> {
  const json = await getWorker().getCFG(funcId);
  return json ? JSON.parse(json) : null;
}

export async function getPathDetail(funcId: number): Promise<PathInfo[]> {
  const json = await getWorker().getPathDetail(funcId);
  return json ? JSON.parse(json) : [];
}

export async function getStateVarAccess(): Promise<StateVarAccess[]> {
  const json = await getWorker().getStateVarAccess();
  return JSON.parse(json);
}

export async function writeSourceUnit(id: number): Promise<string> {
  return getWorker().writeSourceUnit(id);
}

export async function writeNode(id: number): Promise<string> {
  return getWorker().writeNode(id);
}

export async function getInlinedCFG(funcId: number): Promise<InlinedCFGData | null> {
  const json = await getWorker().getInlinedCFG(funcId);
  return json ? JSON.parse(json) : null;
}

export async function writeNodeWithMapping(id: number): Promise<SourceWithMapping> {
  const json = await getWorker().writeNodeWithMapping(id);
  return JSON.parse(json);
}
