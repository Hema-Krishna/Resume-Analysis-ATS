import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';

const api = async (path, opts = {}) => {
  const isForm = opts.body instanceof FormData;
  const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api' + path, { ...opts,
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), Authorization: 'Bearer ' + localStorage.getItem('token') },
    body: opts.body && !isForm ? JSON.stringify(opts.body) : opts.body });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
};
const STATUSES = ['Applied', 'Assessment', 'Interview', 'Offered', 'Rejected', 'Withdrawn'];
const day = d => (d ? String(d).slice(0, 10) : '');
const Err = ({ m }) => (m ? <div className="alert alert-danger py-2">{m}</div> : null);
const Tags = ({ list, cls }) => list.length ? list.map(s => <span key={s} className={'tag ' + cls}>{s}</span>) : <span className="text-muted">None</span>;

function Auth({ onLogin }) {
  const [reg, setReg] = useState(false), [f, setF] = useState({ name: '', email: '', password: '' }), [err, setErr] = useState('');
  const submit = async e => { e.preventDefault(); try { const d = await api(reg ? '/auth/register' : '/auth/login', { method: 'POST', body: f }); localStorage.setItem('token', d.token); onLogin(d.user); } catch (x) { setErr(x.message); } };
  return (<div className="container" style={{ maxWidth: 400, marginTop: '10vh' }}><div className="card p-4"><h4>Job Application Tracker</h4>
    <p className="text-muted">{reg ? 'Create your account' : 'Log in to continue'}</p><Err m={err} />
    <form onSubmit={submit}>{reg && <input className="form-control mb-2" placeholder="Name" onChange={e => setF({ ...f, name: e.target.value })} />}
      <input className="form-control mb-2" type="email" placeholder="Email" onChange={e => setF({ ...f, email: e.target.value })} />
      <input className="form-control mb-3" type="password" placeholder="Password (6+ characters)" onChange={e => setF({ ...f, password: e.target.value })} />
      <button className="btn btn-primary w-100">{reg ? 'Register' : 'Log in'}</button></form>
    <button className="btn btn-link mt-2" onClick={() => { setReg(!reg); setErr(''); }}>{reg ? 'I have an account' : 'Create an account'}</button></div></div>);
}

function Dashboard() {
  const [apps, setApps] = useState([]);
  useEffect(() => { api('/applications').then(setApps); }, []);
  const n = s => apps.filter(a => a.status === s).length;
  const cards = [['Total applications', apps.length, 'briefcase'], ['Interviews', n('Interview'), 'people'], ['Offers', n('Offered'), 'trophy'], ['Rejected', n('Rejected'), 'x-circle']];
  return (<><h4 className="mb-3">Dashboard</h4><div className="row g-3 mb-4">{cards.map(([t, v, i]) => <div className="col-6 col-lg-3" key={t}><div className="card p-3"><i className={`bi bi-${i} fs-4 text-primary`} /><div className="fs-3 fw-bold">{v}</div><div className="text-muted">{t}</div></div></div>)}</div>
    <div className="row g-3"><div className="col-lg-7"><div className="card p-3"><h6>Recent applications</h6>
      <table className="table table-sm"><thead><tr><th>Company</th><th>Role</th><th>Status</th></tr></thead><tbody>{apps.slice(0, 6).map(a => <tr key={a._id}><td>{a.company}</td><td>{a.title}</td><td>{a.status}</td></tr>)}</tbody></table>
      {!apps.length && <p className="text-muted">No applications yet. Add your first one under Applications.</p>}</div></div>
      <div className="col-lg-5"><div className="card p-3"><h6>Status chart</h6>{STATUSES.map(s => <div key={s} className="mb-2"><small>{s} ({n(s)})</small><div className="progress"><div className="progress-bar" style={{ width: apps.length ? (n(s) / apps.length) * 100 + '%' : 0 }} /></div></div>)}</div></div></div></>);
}

const blank = { company: '', title: '', description: '', link: '', location: '', appliedOn: '', deadline: '', interviewDate: '', notes: '', status: 'Applied' };
function Applications() {
  const [apps, setApps] = useState([]), [q, setQ] = useState(''), [status, setStatus] = useState(''), [form, setForm] = useState(null), [err, setErr] = useState('');
  const load = () => api(`/applications?q=${encodeURIComponent(q)}&status=${status}`).then(setApps);
  useEffect(() => { load(); }, [q, status]);
  const save = async e => { e.preventDefault(); try { form._id ? await api('/applications/' + form._id, { method: 'PUT', body: form }) : await api('/applications', { method: 'POST', body: form }); setForm(null); setErr(''); load(); } catch (x) { setErr(x.message); } };
  const del = async id => { if (confirm('Delete this application?')) { await api('/applications/' + id, { method: 'DELETE' }); load(); } };
  const inp = (k, label, type = 'text') => <div className="col-md-6"><label className="form-label">{label}</label><input type={type} className="form-control" value={type === 'date' ? day(form[k]) : form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} /></div>;
  if (form) return (<><h4>{form._id ? 'Edit application' : 'New application'}</h4><Err m={err} /><form onSubmit={save} className="card p-3"><div className="row g-3">
    {inp('company', 'Company *')}{inp('title', 'Job title *')}{inp('location', 'Location')}{inp('link', 'Job link')}{inp('appliedOn', 'Application date', 'date')}{inp('deadline', 'Deadline', 'date')}{inp('interviewDate', 'Interview date', 'date')}
    <div className="col-md-6"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
    <div className="col-12"><label className="form-label">Job description</label><textarea rows="5" className="form-control" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
    <div className="col-12"><label className="form-label">Notes / follow-ups</label><textarea rows="3" className="form-control" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div></div>
    <div className="mt-3"><button className="btn btn-primary me-2">Save application</button><button type="button" className="btn btn-outline-secondary" onClick={() => setForm(null)}>Cancel</button></div></form></>);
  return (<><div className="d-flex justify-content-between mb-3"><h4>Applications</h4><button className="btn btn-primary" onClick={() => setForm({ ...blank })}>Add application</button></div>
    <div className="row g-2 mb-3"><div className="col-md-6"><input className="form-control" placeholder="Search company or title" onChange={e => setQ(e.target.value)} /></div>
      <div className="col-md-3"><select className="form-select" onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div></div>
    <div className="card p-2 table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Company</th><th>Title</th><th>Status</th><th>Deadline</th><th>Interview</th><th /></tr></thead><tbody>
      {apps.map(a => <tr key={a._id}><td>{a.company}</td><td>{a.title}</td><td>{a.status}</td><td>{day(a.deadline)}</td><td>{day(a.interviewDate)}</td>
        <td className="text-end"><button className="btn btn-sm btn-outline-primary me-1" onClick={() => setForm(a)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => del(a._id)}>Delete</button></td></tr>)}</tbody></table>
      {!apps.length && <p className="text-muted p-3 mb-0">Nothing found. Add an application or change the filters.</p>}</div></>);
}

function Resumes() {
  const [list, setList] = useState([]), [sel, setSel] = useState(null), [err, setErr] = useState(''), [msg, setMsg] = useState('');
  const load = () => api('/resumes').then(setList);
  useEffect(() => { load(); }, []);
  const up = async e => { const file = e.target.files[0]; if (!file) return; setErr(''); setMsg('');
    if (!/\.(pdf|docx)$/i.test(file.name)) return setErr('Only PDF and DOCX files are supported.');
    if (file.size > 5 * 1024 * 1024) return setErr('File is larger than 5 MB.');
    const fd = new FormData(); fd.append('file', file);
    try { const r = await api('/resumes', { method: 'POST', body: fd }); setSel(r); load(); } catch (x) { setErr(x.message); } e.target.value = ''; };
  const save = async () => { await api('/resumes/' + sel._id, { method: 'PUT', body: { text: sel.text } }); setMsg('Saved.'); load(); };
  const del = async id => { await api('/resumes/' + id, { method: 'DELETE' }); setSel(null); load(); };
  return (<><h4>Resume upload</h4><Err m={err} /><div className="card p-3 mb-3"><input type="file" accept=".pdf,.docx" className="form-control" onChange={up} /><small className="text-muted">PDF or DOCX, up to 5 MB. Scanned images are not supported.</small></div>
    <div className="row g-3"><div className="col-md-4"><div className="list-group">{list.map(r => <div key={r._id} className={'list-group-item d-flex justify-content-between' + (sel?._id === r._id ? ' active' : '')} role="button" onClick={() => { setSel(r); setMsg(''); }}>{r.fileName}<i className="bi bi-trash" onClick={e => { e.stopPropagation(); del(r._id); }} /></div>)}</div>{!list.length && <p className="text-muted">No resumes yet.</p>}</div>
      <div className="col-md-8">{sel && <div className="card p-3"><label className="form-label">Extracted text (edit to fix errors)</label><textarea rows="16" className="form-control" value={sel.text} onChange={e => setSel({ ...sel, text: e.target.value })} />
        <div className="mt-2"><button className="btn btn-primary" onClick={save}>Save changes</button> <span className="text-success ms-2">{msg}</span></div></div>}</div></div></>);
}

function Analysis({ mode }) {
  const [list, setList] = useState([]), [apps, setApps] = useState([]), [rid, setRid] = useState(''), [jd, setJd] = useState(''), [res, setRes] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api('/resumes').then(setList); api('/applications').then(setApps); }, []);
  const run = async () => { try { setErr(''); setRes(await api('/analyze', { method: 'POST', body: { resumeId: rid, jobDescription: jd } })); } catch (x) { setErr(x.message); setRes(null); } };
  const color = res && (res.score >= 70 ? 'bg-success' : res.score >= 40 ? 'bg-warning' : 'bg-danger');
  return (<><h4>{mode === 'gap' ? 'Skill gap analysis' : 'Resume analysis'}</h4><Err m={err} />
    <div className="card p-3 mb-3"><div className="row g-2"><div className="col-md-6"><select className="form-select" value={rid} onChange={e => setRid(e.target.value)}><option value="">Select a resume</option>{list.map(r => <option key={r._id} value={r._id}>{r.fileName}</option>)}</select></div>
      <div className="col-md-6"><select className="form-select" onChange={e => setJd(apps.find(a => a._id === e.target.value)?.description || '')}><option value="">Use a saved application's description</option>{apps.map(a => <option key={a._id} value={a._id}>{a.company} - {a.title}</option>)}</select></div></div>
      <textarea rows="6" className="form-control my-2" placeholder="Or paste a job description" value={jd} onChange={e => setJd(e.target.value)} /><button className="btn btn-primary" onClick={run}>{mode === 'gap' ? 'Compare skills' : 'Analyze resume'}</button></div>
    {res && <><div className="card p-3 mb-3"><h6>Match score: {res.score}%</h6><div className="progress mb-2" style={{ height: 22 }}><div className={'progress-bar ' + color} style={{ width: res.score + '%' }} /></div>
      <small className="text-muted">Calculated as {res.formula}. This is a keyword matching indicator, not the probability of getting hired.</small></div>
      <div className="row g-3 mb-3"><div className="col-md-4"><div className="card p-3 h-100"><h6>Matched</h6><Tags list={res.matched} cls="matched" /></div></div>
        <div className="col-md-4"><div className="card p-3 h-100"><h6>Partially matched</h6><Tags list={res.partial} cls="partial" /></div></div>
        <div className="col-md-4"><div className="card p-3 h-100"><h6>Missing</h6><Tags list={res.missing} cls="missing" /></div></div></div>
      {mode === 'gap' ? <><div className="row g-3 mb-3"><div className="col-md-6"><div className="card p-3"><h6>Resume skills (extracted)</h6><Tags list={res.resumeSkills} cls="have" /></div></div><div className="col-md-6"><div className="card p-3"><h6>Required skills (job description)</h6><Tags list={res.requiredSkills} cls="have" /></div></div></div>
        <div className="card p-3 mb-3 table-responsive"><h6>Skill-wise details</h6><table className="table table-sm"><thead><tr><th>Skill</th><th>Status</th><th>Detail</th></tr></thead><tbody>{res.details.map(d => <tr key={d.skill}><td>{d.skill}</td><td><span className={'tag ' + d.status}>{d.status}</span></td><td>{d.note}</td></tr>)}</tbody></table></div>
        <div className="card p-3"><h6>Learning recommendations</h6><ul className="mb-0">{res.missing.concat(res.partial).map(s => <li key={s}>{s}: find a beginner course, then build a small project using it.</li>)}</ul></div></>
        : <div className="card p-3"><h6>Suggestions</h6><ul className="mb-0">{res.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}</>}</>);
}

function Interview() {
  const [jd, setJd] = useState(''), [skills, setSkills] = useState(null);
  const go = async () => setSkills((await api('/skills', { method: 'POST', body: { text: jd } })).skills);
  return (<><h4>Interview preparation</h4><div className="card p-3 mb-3"><textarea rows="5" className="form-control mb-2" placeholder="Paste a job description" value={jd} onChange={e => setJd(e.target.value)} /><button className="btn btn-primary" onClick={go}>Generate practice questions</button></div>
    {skills && <div className="card p-3"><ul>{skills.map(s => <li key={s}>Explain {s} and describe a project where you used it.</li>)}<li>Tell me about yourself and why you want this role.</li><li>Describe a hard problem you solved and how.</li></ul>{!skills.length && <p className="text-muted">No known skills detected; try the full description.</p>}</div>}</>);
}

function Profile({ user }) { return <><h4>Profile</h4><div className="card p-3"><p><b>Name:</b> {user.name}</p><p className="mb-0"><b>Email:</b> {user.email}</p></div></>; }

export default function App() {
  const [user, setUser] = useState(null), [ready, setReady] = useState(false), nav = useNavigate();
  useEffect(() => { localStorage.getItem('token') ? api('/auth/me').then(setUser).catch(() => localStorage.removeItem('token')).finally(() => setReady(true)) : setReady(true); }, []);
  if (!ready) return null;
  if (!user) return <Auth onLogin={u => { setUser(u); nav('/'); }} />;
  const links = [['/', 'Dashboard', 'speedometer2'], ['/applications', 'Applications', 'briefcase'], ['/resumes', 'Resume Upload', 'file-earmark-arrow-up'], ['/analysis', 'Resume Analysis', 'graph-up'], ['/gap', 'Skill Gap Analysis', 'bar-chart-steps'], ['/interview', 'Interview Preparation', 'chat-dots'], ['/profile', 'Profile', 'person']];
  return (<div className="d-flex layout"><aside className="side"><div className="text-white fw-bold p-3">Job Tracker</div><nav>{links.map(([to, t, i]) => <NavLink key={to} to={to} end={to === '/'}><i className={`bi bi-${i} me-2`} />{t}</NavLink>)}
    <a href="#" onClick={() => { localStorage.removeItem('token'); setUser(null); }}><i className="bi bi-box-arrow-left me-2" />Log out</a></nav></aside>
    <main className="flex-grow-1 p-4"><Routes><Route path="/" element={<Dashboard />} /><Route path="/applications" element={<Applications />} /><Route path="/resumes" element={<Resumes />} />
      <Route path="/analysis" element={<Analysis mode="analysis" />} /><Route path="/gap" element={<Analysis mode="gap" />} /><Route path="/interview" element={<Interview />} /><Route path="/profile" element={<Profile user={user} />} /><Route path="*" element={<Navigate to="/" />} /></Routes></main></div>);
}
