
export interface RowData {
  [key: string]: any;
}

export interface MatchResult {
  customer: string;
  originalRpl: string;
  matchedRpl: string;
  similarity: number;
  status: 'High' | 'Medium' | 'Low' | 'No Match';
  index: number;
}

export interface ProcessingState {
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
}

export interface ColumnMapping {
  customer: string;
  rpl: string;
}
