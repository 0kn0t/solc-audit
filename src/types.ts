// ─── WASM JSON Response Types ────────────────────────────────────────────────

export interface ContractInfo {
  id: number;
  name: string;
  kind: string;
  isAbstract: boolean;
  sourceFile: string;
  baseContracts: number[];
  functions: FunctionInfo[];
  stateVars: StateVarInfo[];
  events: EventInfo[];
  errors: ErrorInfo[];
  modifiers: ModifierInfo[];
  structs: StructInfo[];
  enums: EnumInfo[];
}

export interface FunctionInfo {
  id: number;
  name: string;
  visibility: string;
  stateMutability: string;
  isConstructor: boolean;
  isVirtual: boolean;
  kind: string;
  params: ParamInfo[];
  returnParams: ParamInfo[];
  hasBody: boolean;
}

export interface StateVarInfo {
  id: number;
  name: string;
  typeString: string;
  visibility: string;
  constant: boolean;
  mutability: string;
}

export interface EventInfo {
  id: number;
  name: string;
  anonymous: boolean;
}

export interface ErrorInfo {
  id: number;
  name: string;
}

export interface ModifierInfo {
  id: number;
  name: string;
}

export interface StructInfo {
  id: number;
  name: string;
  members: { name: string; typeString: string }[];
}

export interface EnumInfo {
  id: number;
  name: string;
  members: string[];
}

export interface ParamInfo {
  name: string;
  typeString: string;
}

// ─── Analysis Results ────────────────────────────────────────────────────────

export interface AnalysisResult {
  functions: FunctionAnalysis[];
  callGraph: CallGraphData;
  summaries: FunctionSummary[];
  globalRanges: GlobalRange[];
  stateVarAnalysis: StateVarAccess[];
}

export interface FunctionAnalysis {
  functionId: number;
  functionName: string;
  contractName: string | null;
  intraPaths: number;
  interPaths: number;
  infeasiblePaths: number;
  feasiblePaths: number;
  returnPaths: number;
  revertPaths: number;
  paths: PathInfo[];
  inlinedCallees: { name: string; paths: number }[];
  findings: SecurityFinding[];
}

// ─── Security Findings ──────────────────────────────────────────────────────

export type FindingCategory = 'reentrancy' | 'access-control' | 'arithmetic' | 'precision' | 'unchecked-return';
export type FindingSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface SecurityFinding {
  category: FindingCategory;
  severity: FindingSeverity;
  // Reentrancy-specific
  externalCall?: number;
  callKind?: string;
  stateWritesAfter?: { varId: number; varName: string }[];
  stateReadsBefore?: { varId: number; varName: string }[];
  // Access-control-specific
  functionId?: number;
  functionName?: string;
  visibility?: string;
  stateMutations?: string[];
  hasSenderCheck?: boolean;
  rolePattern?: string | null;
  // Arithmetic-specific (derived from ArithCheck on feasible paths)
  opNode?: number;
  check?: string;
  bound?: string;
}

export interface UnifiedFinding {
  category: FindingCategory;
  severity: FindingSeverity;
  functionId: number;
  functionName: string;
  contractName: string | null;
  description: string;
  detail: string;
  opNode?: number;
  pathCount?: number;
}

export interface VarRange {
  min: string | null;
  max: string | null;
  intervals: [string, string][];
  exclusions: string[];
}

export interface StatementInfo {
  text: string;
  type: 'assert' | 'assertNot' | 'assign' | 'havoc' | 'checked' | 'call' | 'stmt';
  ranges: Record<string, VarRange>;
}

export interface PathInfo {
  index: number;
  exit: 'return' | 'revert' | 'truncated';
  feasible: boolean;
  statements: (string | StatementInfo)[];
  arithChecks: ArithCheck[];
  inlinedCalls: InlinedCallInfo[];
  constraintCount: number;
}

export interface ArithCheck {
  opNode: number;
  check: string;
  severity: 'high' | 'medium' | 'low';
  bound: string;
  opText?: string;
}

export interface InlinedCallInfo {
  callNode: number;
  calleeId: number;
  calleeName: string;
  calleePaths: number;
  feasiblePaths: number;
}

export interface CallGraphData {
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
  recursiveFunctions: number[];
}

export interface CallGraphNode {
  id: number;
  name: string;
  contractName: string | null;
}

export interface CallGraphEdge {
  from: number;
  to: number | null;
  callSite: number;
  isExternal: boolean;
  // External call metadata (only when isExternal)
  callKind?: string;
  targetType?: string;
  memberName?: string;
}

// ─── Inlined CFG ────────────────────────────────────────────────────────────

export interface InlinedCFGData {
  rootFunction: CFGData;
  inlinedCallees: {
    callSite: number;
    callee: CFGData;
    parentBlock: number | null;
  }[];
  crossEdges: {
    from: string;
    to: string;
    label: string;
  }[];
}

export interface FunctionSummary {
  functionId: number;
  functionName: string;
  contractName: string | null;
  paramRanges: { paramIndex: number; min: number | null; max: number | null }[];
  returnRange: { min: number | null; max: number | null } | null;
  stateWrites: { varId: number; varName: string; min: number | null; max: number | null }[];
}

export interface GlobalRange {
  varId: number;
  varName: string;
  contractName: string | null;
  typeString: string;
  min: number | null;
  max: number | null;
}

export interface StateVarAccess {
  varId: number;
  varName: string;
  typeString: string;
  contractId: number;
  contractName: string;
  readers: FuncRef[];
  writers: FuncRef[];
}

export interface FuncRef {
  funcId: number;
  funcName: string;
  contractName: string | null;
}

// ─── CFG ─────────────────────────────────────────────────────────────────────

export interface CFGData {
  functionId: number;
  functionName: string;
  blocks: CFGBlock[];
  entry: number;
  exits: number[];
  reverts: number[];
  edges: CFGEdge[];
}

export interface CFGBlock {
  id: number;
  stmts: string[];
  terminatorType: string;
  terminator: unknown;
}

export interface CFGEdge {
  from: number;
  to: number;
  label: string;
}

// ─── App State ───────────────────────────────────────────────────────────────

export type ViewTab = 'code' | 'graphs';
export type GraphSubTab = 'cfg' | 'call-graph' | 'state-flow';
export type ContextMode = 'overview' | 'path' | 'variable' | 'raw-data';

export type RiskLevel = 'red' | 'orange' | 'blue' | 'green' | 'none';

/** Gutter risk indicator types */
export interface LineRisk {
  level: RiskLevel;
  symbol: string;  // '!!' | '!' | '~' | '>' | ''
  descriptions: string[];
}

/** Domain annotation for right column */
export interface DomainAnnotation {
  text: string;
  badge: 'narrowed' | 'truncation' | 'precision' | 'external' | 'info';
}

export interface SourceWithMapping {
  source: string;
  lineMap: [number, number, number][]; // [line, col, nodeId]
}

export interface AppState {
  loaded: boolean;
  analyzing: boolean;
  analyzed: boolean;
  fileName: string;
  contracts: ContractInfo[];
  analysis: AnalysisResult | null;
  selectedContractId: number | null;
  selectedFunctionId: number | null;
  selectedPathIndex: number | null;
  activeTab: ViewTab;
}
