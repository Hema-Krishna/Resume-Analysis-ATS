// Skill dictionary: canonical name -> aliases. Extend freely.
const SKILLS = {
  javascript:['js','es6'], typescript:['ts'], python:[], java:[], 'c++':['cpp'], sql:['mysql','postgresql','postgres'],
  mongodb:['mongo'], react:['react.js','reactjs'], 'node.js':['node','nodejs'], express:['express.js'], html:['html5'], css:['css3'],
  bootstrap:[], tailwind:['tailwindcss'], git:['github','gitlab'], docker:[], kubernetes:['k8s'], aws:['amazon web services'],
  'rest api':['rest','restful','api'], 'machine learning':['ml'], 'deep learning':[], 'data analysis':['pandas','numpy'],
  tensorflow:[], pytorch:[], nlp:['natural language processing'], 'data structures':['dsa','algorithms'], linux:[], testing:['jest','unit test','junit'],
  agile:['scrum'], communication:[], 'problem solving':[], django:[], flask:[], 'spring boot':['spring'], redux:[], 'ci/cd':['jenkins','github actions']
};
// If a required skill is missing but a related one is present -> "partial"
const RELATED = { react:['javascript','html','css'], 'node.js':['javascript','express'], express:['node.js'], typescript:['javascript'],
  tensorflow:['python','machine learning','pytorch'], pytorch:['python','machine learning','tensorflow'], 'deep learning':['machine learning'],
  'machine learning':['python','data analysis'], kubernetes:['docker'], 'spring boot':['java'], django:['python'], flask:['python'], redux:['react'],
  'rest api':['node.js','express','django','flask','spring boot'], mongodb:['sql'], sql:['mongodb'] };
const esc = s => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
function extract(text = '') {
  const t = text.toLowerCase(), found = [];
  for (const [name, aliases] of Object.entries(SKILLS))
    if ([name, ...aliases].some(a => new RegExp(`(?<![a-z0-9+])${esc(a)}(?![a-z0-9+])`).test(t))) found.push(name);
  return found;
}
function analyze(resumeText, jdText) {
  const have = extract(resumeText), need = extract(jdText);
  const matched = need.filter(s => have.includes(s));
  const partial = need.filter(s => !have.includes(s) && (RELATED[s] || []).some(r => have.includes(r)));
  const missing = need.filter(s => !matched.includes(s) && !partial.includes(s));
  const score = need.length ? Math.round(((matched.length + 0.5 * partial.length) / need.length) * 100) : 0;
  const details = need.map(s => ({ skill: s,
    status: matched.includes(s) ? 'matched' : partial.includes(s) ? 'partial' : 'missing',
    note: matched.includes(s) ? 'Found in resume' : partial.includes(s) ? 'Related skill found: ' + RELATED[s].filter(r => have.includes(r)).join(', ') : 'Not found in resume' }));
  const suggestions = [];
  if (!need.length) suggestions.push('No known skills were detected in the job description. Paste the full description.');
  missing.forEach(s => suggestions.push(`Learn ${s} and add a project or experience line that uses it (only if you truly have it).`));
  partial.forEach(s => suggestions.push(`Make your ${s} exposure explicit with a concrete project bullet.`));
  if (resumeText.length < 800) suggestions.push('Your resume text is short; add projects, internships and measurable results.');
  return { resumeSkills: have, requiredSkills: need, matched, partial, missing, score, details, suggestions,
    formula: `(${matched.length} matched + 0.5 x ${partial.length} partial) / ${need.length} required skills x 100` };
}
module.exports = { analyze, extract };
