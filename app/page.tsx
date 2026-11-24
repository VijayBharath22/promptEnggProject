'use client';

import { useMemo, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowUpRight, Beaker, ChevronDown, CircleHelp, Clock3, Code2, Command, FileJson2, Gauge, Layers3, Menu, Play, Plus, ShieldCheck, Sparkles, Terminal, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Test = { id: string; category: 'Positive' | 'Negative' | 'Boundary' | 'Security'; description: string; requestPayload: unknown; expectedResult: string; requirementReference: string; assumptionWarnings: string[] };
type Strategy = 'zero-shot' | 'role-based' | 'few-shot' | 'structured' | 'adaptive';
const sampleSpec = `{
  "openapi": "3.0.3",
  "info": { "title": "Chai Store API", "version": "1.0.0" },
  "paths": {
    "/api/v1/products": {
      "get": {
        "summary": "List products",
        "parameters": [
          { "name": "limit", "in": "query", "schema": { "type": "integer", "minimum": 1, "maximum": 100, "default": 20 } },
          { "name": "category", "in": "query", "schema": { "type": "string" } }
        ],
        "responses": {
          "200": { "description": "Product collection", "content": { "application/json": { "schema": { "type": "array", "items": { "$ref": "#/components/schemas/Product" } } } } }
        }
      }
    },
    "/api/v1/products/{productId}": {
      "get": {
        "summary": "Get a product by ID",
        "parameters": [{ "name": "productId", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }],
        "responses": {
          "200": { "description": "Product details", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Product" } } } },
          "404": { "description": "Product not found" }
        }
      }
    }
  },
  "components": { "schemas": { "Product": { "type": "object", "required": ["id", "name", "price"], "properties": { "id": { "type": "string", "format": "uuid" }, "name": { "type": "string" }, "price": { "type": "number", "minimum": 0 }, "category": { "type": "string" } } } } }
}`;

const strategies: { id: Strategy; title: string; detail: string; icon: string }[] = [
  { id: 'adaptive', title: 'Adaptive multi-stage', detail: 'Evidence → gaps → cases → audit', icon: '✳' },
  { id: 'structured', title: 'Structured', detail: 'Requirements mapped to cases', icon: '≡' },
  { id: 'role-based', title: 'Role-based', detail: 'Senior QA engineer perspective', icon: '◈' },
  { id: 'few-shot', title: 'Few-shot', detail: 'Traceable example pattern', icon: '⌘' },
  { id: 'zero-shot', title: 'Zero-shot', detail: 'Direct, evidence-grounded', icon: '↗' },
];

const demos: Test[] = [
  { id: 'TC-001', category: 'Positive', description: 'List products with the default pagination limit.', requestPayload: { method: 'GET', path: '/api/v1/products' }, expectedResult: 'Returns 200 with a JSON array of Product objects.', requirementReference: 'GET /api/v1/products · 200 response', assumptionWarnings: [] },
  { id: 'TC-002', category: 'Positive', description: 'Filter products using a category query parameter.', requestPayload: { method: 'GET', path: '/api/v1/products?category=tea' }, expectedResult: 'Returns 200 with a JSON array of Product objects.', requirementReference: 'GET /api/v1/products · category query parameter', assumptionWarnings: [] },
  { id: 'TC-003', category: 'Boundary', description: 'Request the maximum documented page size.', requestPayload: { method: 'GET', path: '/api/v1/products?limit=100' }, expectedResult: 'The request is accepted; response schema is a JSON array of Product objects.', requirementReference: 'GET /api/v1/products · limit maximum 100', assumptionWarnings: [] },
  { id: 'TC-004', category: 'Boundary', description: 'Request one item, the minimum documented page size.', requestPayload: { method: 'GET', path: '/api/v1/products?limit=1' }, expectedResult: 'The request is accepted; response schema is a JSON array of Product objects.', requirementReference: 'GET /api/v1/products · limit minimum 1', assumptionWarnings: [] },
  { id: 'TC-005', category: 'Negative', description: 'Request a product using a UUID that does not identify a product.', requestPayload: { method: 'GET', path: '/api/v1/products/00000000-0000-4000-8000-000000000000' }, expectedResult: 'Returns 404 (documented as product not found).', requirementReference: 'GET /api/v1/products/{productId} · 404 response', assumptionWarnings: [] },
  { id: 'TC-006', category: 'Security', description: 'Send a SQL-like string in the category filter and check that it is handled as input.', requestPayload: { method: 'GET', path: "/api/v1/products?category=' OR 1=1 --" }, expectedResult: 'Response behavior is unspecified by the OpenAPI document.', requirementReference: 'GET /api/v1/products · category query parameter', assumptionWarnings: ['No security response contract is documented; verify manually without asserting a status code.'] },
  { id: 'TC-007', category: 'Negative', description: 'Provide a limit above the documented maximum.', requestPayload: { method: 'GET', path: '/api/v1/products?limit=101' }, expectedResult: 'Handling of out-of-range limit is unspecified by the OpenAPI document.', requirementReference: 'GET /api/v1/products · limit maximum 100', assumptionWarnings: ['The spec documents the maximum but does not define the validation response.'] },
];

const trend = [{ day: 'Mon', tests: 34 }, { day: 'Tue', tests: 48 }, { day: 'Wed', tests: 41 }, { day: 'Thu', tests: 67 }, { day: 'Fri', tests: 55 }, { day: 'Sat', tests: 82 }, { day: 'Sun', tests: 74 }];
const palette: Record<string, string> = { Positive: '#67d5a4', Negative: '#f08f79', Boundary: '#e8bb62', Security: '#a995f2' };

function metricNum(n: number) { return new Intl.NumberFormat('en-US').format(n); }

export default function Home() {
  const [inputType, setInputType] = useState<'openapi' | 'description'>('openapi');
  const [input, setInput] = useState(sampleSpec);
  const [strategy, setStrategy] = useState<Strategy>('adaptive');
  const [tests, setTests] = useState<Test[]>(demos);
  const [demoMode, setDemoMode] = useState(true);
  const [hasLiveRun, setHasLiveRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('All tests');
  const [section, setSection] = useState('Overview');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(1.24);
  const [tokenCount, setTokenCount] = useState(1840);
  const [coverage, setCoverage] = useState(86);
  const [inputOpen, setInputOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const duplicateCount = tests.length - new Set(tests.map(t => `${t.category}:${t.description.toLowerCase().replace(/[^a-z0-9]/g, '')}`)).size;
  const unsupported = tests.filter(t => t.assumptionWarnings.length).length;
  const unsupportedRate = tests.length ? Math.round(unsupported / tests.length * 100) : 0;
  const categories = useMemo(() => ['Positive', 'Negative', 'Boundary', 'Security'].map(name => ({ name, value: tests.filter(t => t.category === name).length })), [tests]);
  const chartTrend = demoMode ? trend : [{ day: 'Run', tests: tests.length }];
  const filtered = activeTab === 'All tests' ? tests : tests.filter(t => t.category === activeTab);

  async function generate(): Promise<boolean> {
    setError(''); setLoading(true);
    if (demoMode) {
      await new Promise(resolve => setTimeout(resolve, 850));
      setTests(demos); setCoverage(86); setTokenCount(1840); setElapsed(1.24); setLoading(false); setSection('Overview');
      return true;
    }
    const start = performance.now();
    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, inputType, strategy }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Generation failed.');
      setTests(data.tests as Test[]); setCoverage(Number(data.coverage) || 0); setTokenCount(Number(data.tokens) || 0); setElapsed(Number(((performance.now() - start) / 1000).toFixed(2))); setHasLiveRun(true); setSection('Overview');
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'Generation failed. Please retry.'); return false; }
    finally { setLoading(false); }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), strategy, coverage, tests }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'testforge-test-cases.json'; a.click(); URL.revokeObjectURL(url);
  }

  return <main className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Beaker size={20} strokeWidth={2.2} /></div><span>testforge<span className="brand-ai">.ai</span></span><button className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={17}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <button className="project-select"><span className="project-dot"/> API Quality Lab <ChevronDown size={14}/></button>
      <div className="nav-label">Workspace</div>
      <nav className="nav-group">
        {[['Overview', <Layers3 size={17}/>], ['Test generation', <Sparkles size={17}/>], ['Evaluation', <Activity size={17}/>]].map(([label, icon]) => <button key={String(label)} className={`nav-item ${section === label ? 'active' : ''}`} onClick={() => { setSection(String(label)); if(label === 'Test generation') setInputOpen(true); else if(label === 'Evaluation') document.getElementById('evaluation')?.scrollIntoView({behavior:'smooth'}); else window.scrollTo({top:0,behavior:'smooth'}); setSidebarOpen(false); }}><span>{icon}</span>{label}{label === 'Evaluation' && <span className="nav-pill">NEW</span>}</button>)}
      </nav>
      <div className="nav-label">Resources</div>
      <nav className="nav-group">
        <button className="nav-item" onClick={() => {setInputOpen(true);setSidebarOpen(false);}}><span><FileJson2 size={17}/></span>API specifications</button>
        <button className="nav-item" onClick={() => {setSection('Evaluation');document.getElementById('evaluation')?.scrollIntoView({behavior:'smooth'});setSidebarOpen(false);}}><span><Gauge size={17}/></span>Strategy benchmarks</button>
      </nav>
      <div className="sidebar-bottom"><div className="usage-card"><div className="usage-title"><span>Monthly usage</span><span>72%</span></div><div className="usage-bar"><i/></div><div className="usage-caption">7,240 of 10,000 tokens</div><button>View usage <ArrowUpRight size={13}/></button></div><div className="profile"><div className="avatar">AK</div><div className="profile-text"><b>Alex Kumar</b><span>Free workspace</span></div><ChevronDown size={15}/></div></div>
    </aside>

    <div className="main-area">
      <header className="topbar"><div className="top-left"><button className="menu-button" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu size={19}/></button><span className="breadcrumb">Workspace <span>/</span> <b>{section}</b></span></div><div className="top-actions"><div className="api-status"><i/> API operational</div><button className="icon-button" title="Help"><CircleHelp size={17}/></button><div className="top-avatar">AK</div></div></header>
      <div className="content-wrap">
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> API QUALITY WORKSPACE</div><h1>Good morning, Alex <span className="wave">✳</span></h1><p>Generate evidence-grounded API tests and measure their quality.</p></div><div className="heading-actions"><div className={`mode-chip ${demoMode ? 'demo' : 'live'}`}><span/>{demoMode ? 'Demo mode' : 'Live AI'}<button onClick={() => {setDemoMode(!demoMode); setError('');}} aria-label="Toggle demo mode"><span className="switch-knob"/></button></div><button className="button-primary" onClick={() => setInputOpen(true)}><Plus size={16}/> New generation</button></div></div>

        {(demoMode || !hasLiveRun) && <div className="demo-banner"><div className="demo-icon"><Beaker size={15}/></div><span><b>{demoMode?'Demo data active':'Sample results shown'}</b> — {demoMode ? <>Sample results are shown. Switch to Live AI and add <code>OPENAI_API_KEY</code> to your server environment to generate real test cases.</> : <>The dashboard keeps the sample run until your first live generation succeeds.</>}</span><button onClick={() => setInputOpen(true)}>{demoMode?'Configure live AI':'Generate live tests'} <ArrowUpRight size={13}/></button></div>}
        {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15}/></button></div>}

        <section className="metrics-grid">
          <article className="metric-card"><div className="metric-top"><span>Total test cases</span><div className="metric-icon orange"><Code2 size={17}/></div></div><div className="metric-value">{metricNum(tests.length)}<span className="metric-change positive">+{tests.length} <span>this run</span></span></div><div className="metric-foot"><span className="sparkline">▁▂▃▂▄▅▄▆▇</span><span>Across all categories</span></div></article>
          <article className="metric-card"><div className="metric-top"><span>Requirement coverage</span><div className="metric-icon green"><ShieldCheck size={17}/></div></div><div className="metric-value">{coverage}<small>%</small><span className="metric-change positive">↑ 8.4% <span>vs last run</span></span></div><div className="metric-foot"><div className="mini-progress"><i style={{width:`${coverage}%`}}/></div><span>Well covered</span></div></article>
          <article className="metric-card"><div className="metric-top"><span>Unsupported assumptions</span><div className="metric-icon purple"><CircleHelp size={17}/></div></div><div className="metric-value">{unsupportedRate}<small>%</small><span className={`metric-change ${unsupportedRate < 15 ? 'positive' : 'warning'}`}>{unsupported} flagged <span>to review</span></span></div><div className="metric-foot"><span className="assumption-dots">● ● ● ● ● ● ●</span><span>Warning rate</span></div></article>
          <article className="metric-card"><div className="metric-top"><span>Token usage & latency</span><div className="metric-icon blue"><Clock3 size={17}/></div></div><div className="metric-value">{metricNum(tokenCount)}<span className="metric-change neutral">{elapsed}s <span>avg latency</span></span></div><div className="metric-foot"><span className="token-icon">ϟ</span><span>Tokens in latest run</span></div></article>
        </section>

        <section className="charts-grid">
          <article className="panel trend-panel"><div className="panel-heading"><div><h2>Generation activity</h2><p>{demoMode?'Demo sample · test cases over 7 days':'Latest live run'}</p></div><button className="period-button">{demoMode?'Last 7 days':'This run'} <ChevronDown size={14}/></button></div><div className="activity-summary"><strong>{demoMode?'401':tests.length}</strong><span>{demoMode?'sample cases generated':'cases generated'} {demoMode&&<em>↑ 12.8%</em>}</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartTrend} margin={{top:12,right:8,left:-22,bottom:0}}><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eb8e56" stopOpacity={0.2}/><stop offset="100%" stopColor="#eb8e56" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#292b32" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{fill:'#777a85',fontSize:11}} dy={9}/><YAxis tickLine={false} axisLine={false} tick={{fill:'#777a85',fontSize:11}}/><Tooltip contentStyle={{background:'#191a1f',border:'1px solid #363841',borderRadius:9,color:'#fff',fontSize:12}}/><Area type="monotone" dataKey="tests" stroke="#e89a66" strokeWidth={2.5} fill="url(#chartFill)" activeDot={{r:4,fill:'#e89a66',stroke:'#17181d',strokeWidth:2}}/></AreaChart></ResponsiveContainer></div></article>
          <article className="panel category-panel"><div className="panel-heading"><div><h2>Test distribution</h2><p>Cases by category</p></div><button className="more-button">•••</button></div><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="value" nameKey="name" innerRadius={57} outerRadius={77} stroke="none" paddingAngle={4} startAngle={90} endAngle={-270}>{categories.map((entry, i) => <Cell key={entry.name} fill={palette[entry.name]} />)}</Pie><Tooltip contentStyle={{background:'#191a1f',border:'1px solid #363841',borderRadius:8,color:'#fff',fontSize:12}}/></PieChart></ResponsiveContainer><div className="donut-center"><b>{tests.length}</b><span>Total cases</span></div></div><div className="legend-grid">{categories.map(cat => <div key={cat.name} className="legend-item"><i style={{background:palette[cat.name]}}/>{cat.name}<b>{cat.value}</b></div>)}</div></article>
        </section>

    <section className="lower-grid" id="evaluation">
          <article className="panel strategy-panel"><div className="panel-heading"><div><h2>Prompt strategy comparison</h2><p>{demoMode ? 'Sample benchmark · quality score across strategies' : 'Measured metrics from the latest live run'}</p></div><button className="text-button" onClick={() => setSection('Evaluation')}>Full evaluation <ArrowUpRight size={13}/></button></div><div className="strategy-list">{(demoMode ? [{name:'Adaptive multi-stage',score:94,coverage:'96%',time:'1.8s',color:'#ef9c63'}, {name:'Structured',score:89,coverage:'91%',time:'1.2s',color:'#8f99e8'}, {name:'Few-shot',score:84,coverage:'87%',time:'1.4s',color:'#72c6ae'}] : [{name:strategies.find(s=>s.id===strategy)?.title || 'Selected strategy',score:coverage,coverage:`${coverage}%`,time:`${elapsed}s`,color:'#ef9c63'}]).map((item,i)=><div className="strategy-row" key={item.name}><div className="strategy-rank">0{i+1}</div><div className="strategy-name"><b>{item.name}</b><div className="score-track"><i style={{width:`${item.score}%`,background:item.color}}/></div></div><div className="strategy-score">{item.score}<small>/100</small></div><div className="strategy-coverage">{item.coverage}<small>coverage</small></div><div className="strategy-latency">{item.time}<small>latency</small></div><div className="trophy">{demoMode&&i===0?'✦':''}</div></div>)}</div><div className="strategy-note"><span>✦</span> {demoMode ? 'Sample benchmark values are shown in Demo mode.' : 'Live score reflects documented requirement coverage for this run.'}</div></article>
          <article className="panel quality-panel"><div className="panel-heading"><div><h2>Quality checks</h2><p>Latest generation run</p></div><div className="passed-chip"><i/> Passed</div></div><div className="quality-list"><div><span className="check-mark">✓</span><span>Schema validation</span><b>Passed</b></div><div><span className="check-mark">✓</span><span>Requirement traceability</span><b>{coverage}%</b></div><div><span className="check-mark">✓</span><span>Duplicate rate</span><b>{tests.length ? Math.round(duplicateCount/tests.length*100) : 0}%</b></div><div><span className="check-mark warn">!</span><span>Assumption review</span><b className="warn-text">{unsupported} flagged</b></div></div><button className="quality-link" onClick={() => {setSection('Evaluation');document.getElementById('evaluation')?.scrollIntoView({behavior:'smooth'});}}>View validation report <ArrowUpRight size={13}/></button></article>
        </section>

        <section className="panel tests-panel"><div className="tests-heading"><div><div className="table-title"><h2>Generated test cases</h2><span className="case-count">{tests.length}</span></div><p>Evidence-grounded cases from your latest generation</p></div><div className="test-actions"><button className="button-ghost" onClick={() => setInputOpen(true)}><Play size={14}/> Generate tests</button><button className="button-ghost export-button" onClick={exportJson}><ArrowDownToLine size={14}/> Export JSON</button></div></div><div className="tabs-row">{['All tests','Positive','Negative','Boundary','Security'].map(tab=><button key={tab} className={`tab ${activeTab===tab?'selected':''}`} onClick={()=>setActiveTab(tab)}>{tab}<span>{tab==='All tests'?tests.length:tests.filter(t=>t.category===tab).length}</span></button>)}<div className="validation-status"><span/> JSON validated</div></div><div className="table-scroll"><table><thead><tr><th>TEST CASE</th><th>CATEGORY</th><th>DESCRIPTION</th><th>EXPECTED RESULT</th><th>TRACEABILITY</th><th></th></tr></thead><tbody>{filtered.map(test=><><tr key={test.id} onClick={()=>setExpanded(expanded===test.id?null:test.id)} className="test-row"><td><code>{test.id}</code></td><td><span className={`category-tag ${test.category.toLowerCase()}`}><i/>{test.category}</span></td><td className="description-cell">{test.description}</td><td className="result-cell">{test.expectedResult}</td><td className="trace-cell">{test.requirementReference}</td><td><ChevronDown size={15} className={`row-chevron ${expanded===test.id?'rotated':''}`}/></td></tr>{expanded===test.id && <tr className="detail-row" key={`${test.id}-details`}><td colSpan={6}><div className="test-details"><div><span>REQUEST PAYLOAD</span><pre>{JSON.stringify(test.requestPayload,null,2)}</pre></div><div><span>ASSUMPTION WARNINGS</span>{test.assumptionWarnings.length ? test.assumptionWarnings.map(w=><p className="warning-line" key={w}>⚠ {w}</p>) : <p className="no-warning">No unsupported assumptions identified.</p>}</div></div></td></tr>}</>)}</tbody></table>{filtered.length===0&&<div className="empty-state">No {activeTab.toLowerCase()} test cases in this run.</div>}</div><div className="table-footer"><span>Showing <b>{filtered.length}</b> of <b>{tests.length}</b> test cases</span><button onClick={exportJson}>Download all test cases <ArrowDownToLine size={13}/></button></div></section>
        <footer className="page-footer"><span>TestForge AI <i>·</i> Evidence-grounded API quality</span><span><span className="footer-live"/> All systems operational</span></footer>
      </div>
    </div>

    {inputOpen && <div className="modal-backdrop" onClick={e => { if(e.target===e.currentTarget) setInputOpen(false); }}><section className="generation-modal"><div className="modal-header"><div><div className="modal-eyebrow"><Sparkles size={13}/> NEW GENERATION</div><h2>Generate API test cases</h2><p>Ground every test in your documented API behavior.</p></div><button className="modal-close" onClick={()=>setInputOpen(false)}><X size={18}/></button></div><div className="input-switch"><button className={inputType==='openapi'?'chosen':''} onClick={()=>setInputType('openapi')}><FileJson2 size={15}/> OpenAPI specification</button><button className={inputType==='description'?'chosen':''} onClick={()=>setInputType('description')}><Terminal size={15}/> Endpoint description</button></div><div className="editor-label"><span>{inputType==='openapi'?'SPECIFICATION JSON':'ENDPOINT DESCRIPTION'}</span><button onClick={()=>setInput(sampleSpec)}>Load sample API</button></div><textarea className="spec-editor" spellCheck={false} value={input} onChange={e=>setInput(e.target.value)} placeholder={inputType==='openapi'?'Paste your OpenAPI JSON here…':'Describe endpoint behavior and documented requirements…'} />{inputType==='openapi'&&<div className="editor-hint"><span className="hint-dot"/> OpenAPI 3.x specification detected <button onClick={()=>{try{JSON.parse(input);setError('');}catch{setError('The OpenAPI input is not valid JSON. Please check its syntax.');}}}>Validate JSON</button></div>}<div className="strategy-select-label"><span>PROMPT STRATEGY</span><span>Compare approaches in Evaluation</span></div><div className="strategy-options">{strategies.map(s=><button key={s.id} onClick={()=>setStrategy(s.id)} className={`strategy-option ${strategy===s.id?'strategy-chosen':''}`}><span className="strategy-icon">{s.icon}</span><span><b>{s.title}</b><small>{s.detail}</small></span>{strategy===s.id&&<span className="strategy-radio">✓</span>}</button>)}</div><div className="modal-footer"><span><ShieldCheck size={15}/> Unsupported behavior is flagged, never assumed.</span><button className="button-primary generate-button" disabled={loading||input.trim().length<5} onClick={async()=>{const success=await generate(); if(success) setInputOpen(false);}}>{loading?<><span className="spinner"/> Generating…</>:<><Sparkles size={15}/> Generate test cases</>}</button></div></section></div>}
  </main>;
}
