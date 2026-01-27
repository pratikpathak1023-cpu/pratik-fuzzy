
import React, { useState, useCallback, useMemo } from 'react';
import { RowData, MatchResult, ProcessingState, ColumnMapping } from './types';
import { readExcelFile, exportToExcel } from './services/excelService';
import { performFuzzyLookup, getGeminiInsights } from './services/fuzzyService';
import FileUpload from './components/FileUpload';

const App: React.FC = () => {
  const [rawData, setRawData] = useState<RowData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ customer: '', rpl: '' });
  const [results, setResults] = useState<MatchResult[]>([]);
  const [processing, setProcessing] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [aiInsights, setAiInsights] = useState<string>('');

  const handleFileSelect = async (file: File) => {
    try {
      setProcessing({ status: 'processing', progress: 0, message: 'Reading file...' });
      const data = await readExcelFile(file);
      if (data.length > 0) {
        const cols = Object.keys(data[0]);
        setRawData(data);
        setColumns(cols);
        
        // Auto-detect columns
        const custCol = cols.find(c => c.toLowerCase().includes('customer')) || cols[0];
        const rplCol = cols.find(c => c.toLowerCase().includes('rpl')) || cols[Math.min(1, cols.length - 1)];
        setMapping({ customer: custCol, rpl: rplCol });
        
        setProcessing({ status: 'idle', progress: 0, message: '' });
      }
    } catch (error) {
      setProcessing({ status: 'error', progress: 0, message: 'Error reading file.' });
    }
  };

  const startLookup = async () => {
    if (!mapping.customer || !mapping.rpl) return;

    setProcessing({ status: 'processing', progress: 0, message: 'Performing fuzzy lookup...' });
    try {
      const matchResults = await performFuzzyLookup(
        rawData,
        mapping.customer,
        mapping.rpl,
        (progress) => setProcessing(prev => ({ ...prev, progress }))
      );
      setResults(matchResults);
      setProcessing({ status: 'completed', progress: 100, message: 'Matching complete!' });

      // Get AI Insights
      setProcessing(prev => ({ ...prev, message: 'Generating AI analysis...' }));
      const insights = await getGeminiInsights(matchResults);
      setAiInsights(insights);
    } catch (error) {
      setProcessing({ status: 'error', progress: 0, message: 'Error during matching process.' });
    }
  };

  const handleDownload = () => {
    if (results.length === 0) return;
    
    const exportData = results.map(res => ({
      ...rawData[res.index],
      'Fuzzy Match Result': res.matchedRpl,
      'Similarity %': res.similarity,
      'Match Status': res.status
    }));
    
    exportToExcel(exportData, 'FuzzyLookupResults');
  };

  const reset = () => {
    setRawData([]);
    setColumns([]);
    setResults([]);
    setProcessing({ status: 'idle', progress: 0, message: '' });
    setAiInsights('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <i className="fa-solid fa-bolt text-white text-xl"></i>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              FuzzyLink AI
            </h1>
          </div>
          <div className="flex space-x-4">
            {rawData.length > 0 && (
              <button
                onClick={reset}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear All
              </button>
            )}
            <div className="flex items-center space-x-1 text-xs text-gray-400">
              <i className="fa-solid fa-shield-halved"></i>
              <span>Secure Offline Processing</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-8">
        {/* Step 1: Upload */}
        {rawData.length === 0 ? (
          <section className="mt-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Reconcile Lists Effortlessly</h2>
              <p className="text-gray-500 max-w-2xl mx-auto text-lg">
                Identify matching records between your customer database and Restricted Party Lists (RPL) 
                using advanced fuzzy logic and AI-powered similarity analysis.
              </p>
            </div>
            <FileUpload onFileSelect={handleFileSelect} disabled={processing.status === 'processing'} />
          </section>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Panel: Config */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center">
                  <i className="fa-solid fa-sliders mr-2 text-blue-500"></i>
                  Matching Configuration
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name Column</label>
                    <select
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={mapping.customer}
                      onChange={(e) => setMapping(prev => ({ ...prev, customer: e.target.value }))}
                      disabled={processing.status === 'processing' || results.length > 0}
                    >
                      {columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">RPL List Column</label>
                    <select
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={mapping.rpl}
                      onChange={(e) => setMapping(prev => ({ ...prev, rpl: e.target.value }))}
                      disabled={processing.status === 'processing' || results.length > 0}
                    >
                      {columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  
                  {results.length === 0 && (
                    <button
                      onClick={startLookup}
                      disabled={processing.status === 'processing'}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-semibold transition-all shadow-md flex items-center justify-center space-x-2"
                    >
                      {processing.status === 'processing' ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i>
                          <span>Processing {processing.progress}%</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-magnifying-glass"></i>
                          <span>Start Fuzzy Lookup</span>
                        </>
                      )}
                    </button>
                  )}

                  {results.length > 0 && (
                    <button
                      onClick={handleDownload}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all shadow-md flex items-center justify-center space-x-2"
                    >
                      <i className="fa-solid fa-download"></i>
                      <span>Download Excel Result</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Stats Card */}
              {results.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="font-semibold text-lg mb-4">Summary Stats</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <span className="block text-xs text-green-600 font-bold uppercase tracking-wider">High Match</span>
                      <span className="text-2xl font-bold text-green-700">
                        {results.filter(r => r.status === 'High').length}
                      </span>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                      <span className="block text-xs text-yellow-600 font-bold uppercase tracking-wider">Medium Match</span>
                      <span className="text-2xl font-bold text-yellow-700">
                        {results.filter(r => r.status === 'Medium').length}
                      </span>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                      <span className="block text-xs text-orange-600 font-bold uppercase tracking-wider">Low Match</span>
                      <span className="text-2xl font-bold text-orange-700">
                        {results.filter(r => r.status === 'Low').length}
                      </span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="block text-xs text-gray-500 font-bold uppercase tracking-wider">Total Rows</span>
                      <span className="text-2xl font-bold text-gray-700">{results.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel: Data Table / Results */}
            <div className="lg:col-span-2 space-y-6">
              {/* Progress Overlay */}
              {processing.status === 'processing' && (
                <div className="bg-white rounded-xl border p-12 text-center animate-pulse">
                  <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fa-solid fa-microchip text-4xl text-blue-600"></i>
                  </div>
                  <h4 className="text-xl font-semibold mb-2">{processing.message}</h4>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 max-w-md mx-auto overflow-hidden">
                    <div 
                      className="bg-blue-600 h-2.5 transition-all duration-300 ease-out" 
                      style={{ width: `${processing.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* AI Insight Bar */}
              {aiInsights && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 text-indigo-200 group-hover:text-indigo-300 transition-colors">
                    <i className="fa-solid fa-sparkles text-4xl"></i>
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-indigo-800 font-bold flex items-center mb-2">
                      <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
                      AI Data Quality Insights
                    </h4>
                    <p className="text-indigo-900 leading-relaxed italic">
                      "{aiInsights}"
                    </p>
                  </div>
                </div>
              )}

              {/* Table Result */}
              {results.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-semibold">Result Preview (Top 50)</h3>
                    <span className="text-xs text-gray-400">Showing first 50 results</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 border-b text-gray-600 font-medium">
                        <tr>
                          <th className="px-6 py-3">Customer</th>
                          <th className="px-6 py-3">RPL Reference</th>
                          <th className="px-6 py-3">Match</th>
                          <th className="px-6 py-3">Confidence</th>
                          <th className="px-6 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {results.slice(0, 50).map((res, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-800">{res.customer}</td>
                            <td className="px-6 py-4 text-gray-500">{res.originalRpl}</td>
                            <td className="px-6 py-4 text-blue-600 font-medium">{res.matchedRpl}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                <div className="flex-1 w-16 bg-gray-100 h-1.5 rounded-full">
                                  <div 
                                    className={`h-1.5 rounded-full ${
                                      res.similarity > 80 ? 'bg-green-500' : 
                                      res.similarity > 50 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${res.similarity}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs tabular-nums text-gray-600">{res.similarity}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                res.status === 'High' ? 'bg-green-100 text-green-700' :
                                res.status === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                res.status === 'Low' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {res.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {results.length > 50 && (
                    <div className="p-4 text-center bg-gray-50 border-t text-sm text-gray-500">
                      Plus {results.length - 50} more records. Download for full report.
                    </div>
                  )}
                </div>
              ) : rawData.length > 0 && (
                <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
                  <i className="fa-solid fa-table text-4xl mb-4 opacity-20"></i>
                  <p>Configuration ready. Click "Start Fuzzy Lookup" to process {rawData.length} rows.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-gray-400 text-sm">
          <p>© 2024 FuzzyLink AI. All matching performed locally in-browser.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-blue-500">Privacy Policy</a>
            <a href="#" className="hover:text-blue-500">How it works</a>
            <a href="#" className="hover:text-blue-500">Feedback</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
