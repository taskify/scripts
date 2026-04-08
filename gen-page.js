import jwt from 'jsonwebtoken'
import { writeFileSync } from 'fs'

var ZAI_KEY = process.env.ZAI_API_KEY || process.env.Z_API_KEY
var [kid, secret] = ZAI_KEY.split('.')
var token = jwt.sign({api_key:kid,exp:Math.floor(Date.now()/1000)+3600,timestamp:Date.now()},secret,{algorithm:'HS256',header:{alg:'HS256',sign_type:'SIGN',kid:kid}})

var TOPIC = process.argv[2] || 'Famous Computer Scientists'
var OUTPUT = process.argv[3] || '/tmp/taskify/test-losos/glm-output.html'

var prompt = `Generate a single index.html about "${TOPIC}" following this EXACT pattern:

The file must have:
1. A <script type="application/ld+json" id="data"> with 6-8 items, each having relevant fields and an icon (emoji)
2. CSS: body system-ui font, max-width 800px centered, white cards with border-radius and padding
3. A <div id="app"></div>
4. A <script type="module"> that does:
   - import { html, render } from "https://losos.org/html.js"
   - var data = JSON.parse(document.getElementById("data").textContent)
   - render(document.getElementById("app"), html\`...\`)

CRITICAL: render() takes (container, template) — container is the FIRST argument, template is SECOND.
Use var not const. Use function() not arrow functions.
Under 60 lines.`

var res = await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions',{
  method:'POST',
  headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({
    model:'glm-5',
    messages:[
      {role:'system',content:'You generate complete, self-contained index.html files. Be visually creative — use color, gradients, visual hierarchy, and varied layouts. Each page should feel unique and engaging, not just a list of cards. Output ONLY the HTML, nothing else. No markdown code fences. No explanation.'},
      {role:'user',content:prompt}
    ]
  })
})
var result = await res.json()
var content = result.choices[0].message.content
content = content.replace(/^```html?\n?/,'').replace(/\n?```\s*$/,'')
writeFileSync(OUTPUT, content)
console.log('Lines:', content.split('\n').length)
console.log('Tokens:', result.usage.total_tokens)
