---
name: find-3d-assets
description: Find, download, and integrate low-poly 3D models (GLB/GLTF) for web projects. Use when the user needs 3D assets, furniture models, game assets, or asks about KayKit, poly.pizza, Kenney, Sketchfab, or Three.js models.
---

# Finding 3D Assets for Web Projects

## Search Strategy

When looking for a specific 3D model, follow this priority order:

### 1. Check Local Models First

Look in `modules/web-app/public/models/` — the model (or something close) might already exist.
See the [Current Project Models](#current-project-models) table at the bottom.

### 2. Search Sketchfab (Largest Library, API Download)

Sketchfab is the primary source for high-quality downloadable 3D models. It has API-based download
which makes it the most automatable option when the user has a `SKETCHFAB_API_TOKEN`.

**Finding models — web search:**
```
site:sketchfab.com [object name] low poly downloadable free
sketchfab [object name] CC0 OR CC-BY download
```

**Finding models — direct Sketchfab search URL:**
```
https://sketchfab.com/search?q=[keyword]&downloadable=true&sort_by=-likeCount
```

**Finding models — Sketchfab Search API:**
```bash
# Search without auth (public models)
curl -s "https://api.sketchfab.com/v3/search?type=models&q=standing+desk&downloadable=true&sort_by=-likeCount&count=5" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('results', []):
    print(f\"{r['name']} by {r['user']['displayName']} — {r['faceCount']} tris — {r['license']['label']}\"
          f\"  https://sketchfab.com/3d-models/{r['slug']}-{r['uid']}\")
"
```

**Filters to use when searching:**
- `downloadable=true` — only models with download enabled
- `sort_by=-likeCount` — most popular first (usually highest quality)
- `license=by` for CC-BY, `license=cc0` for CC0
- `max_face_count=20000` — keep it web-friendly

#### Sketchfab Download Workflow (Automated)

**Requires:** `SKETCHFAB_API_TOKEN` environment variable (stored in `.env`, loaded by direnv).
Get one at: https://sketchfab.com/settings/password → "API Token" section.

```bash
MODEL_ID="65a7f4b06a5f4954a0d43eb8812dd165"   # hex ID from the model URL
OUTPUT="standingDesk.glb"                       # target filename

# Step 1 — Get signed download URLs (expires in 5 min)
DOWNLOAD_JSON=$(curl -s \
  -H "Authorization: Token $SKETCHFAB_API_TOKEN" \
  "https://api.sketchfab.com/v3/models/$MODEL_ID/download")

# Step 2 — Extract the GLB URL (preferred) or fall back to GLTF zip
GLB_URL=$(echo "$DOWNLOAD_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('glb',{}).get('url',''))")
GLTF_URL=$(echo "$DOWNLOAD_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('gltf',{}).get('url',''))")

if [ -n "$GLB_URL" ]; then
  # Direct GLB — no conversion needed
  curl -L -o "/tmp/${OUTPUT}" "$GLB_URL"
else
  # GLTF zip — download, unzip, convert
  curl -L -o /tmp/model.zip "$GLTF_URL"
  unzip -o /tmp/model.zip -d /tmp/model_tmp/
  npx gltf-pipeline -i /tmp/model_tmp/scene.gltf -o "/tmp/${OUTPUT}"
  rm -rf /tmp/model.zip /tmp/model_tmp/
fi

# Step 3 — Optimize (MANDATORY — see "Post-Download Optimization" section)
# Sketchfab GLBs are typically 5-30MB; this pipeline gets them to 100-500KB.
npx gltf-transform resize "/tmp/${OUTPUT}" /tmp/opt-s1.glb --width 256 --height 256
npx gltf-transform simplify /tmp/opt-s1.glb /tmp/opt-s2.glb --ratio 0.05 --error 0.02
npx gltf-transform webp /tmp/opt-s2.glb /tmp/opt-s3.glb
npx gltf-transform prune /tmp/opt-s3.glb /tmp/opt-s4.glb
npx gltf-transform draco /tmp/opt-s4.glb "modules/web-app/public/models/${OUTPUT}"
rm -f /tmp/opt-s*.glb "/tmp/${OUTPUT}"

# Step 4 — Generate gzip sidecar for nginx gzip_static
node -e "
const fs=require('fs'),zlib=require('zlib');
const p='modules/web-app/public/models/${OUTPUT}';
const d=fs.readFileSync(p);
fs.writeFileSync(p+'.gz',zlib.gzipSync(d,{level:9}));
console.log('${OUTPUT}:',(d.length/1024).toFixed(0)+'KB →',(fs.statSync(p+'.gz').size/1024).toFixed(0)+'KB gzipped');
"
```

**API response format** (all four formats may be available):
```json
{
  "glb":    { "url": "https://...standing_desk.glb?...",  "size": 2300908, "expires": 300 },
  "gltf":   { "url": "https://...standing_desk.zip?...",  "size": 6265725, "expires": 300 },
  "usdz":   { "url": "https://...Standing_Desk.usdz?...", "size": 1893909, "expires": 300 },
  "source": { "url": "https://...standing-desk.zip?...",  "size": 13136219, "expires": 300 }
}
```
- Prefer `glb` (single binary, ready to use)
- Fall back to `gltf` (zip with scene.gltf + textures, needs conversion)
- `source` is the original upload format (often large, avoid)
- URLs expire in 5 minutes — download immediately after requesting

#### Sketchfab Manual Download

If API isn't available:
1. Open the model page in browser
2. Click "Download 3D Model"
3. Choose **Autoconverted format (glTF)** — this gives a zip
4. Unzip, find `scene.gltf` inside
5. Convert: `npx gltf-pipeline -i scene.gltf -o model.glb`

#### Sketchfab URL Anatomy

```
https://sketchfab.com/3d-models/standing-desk-65a7f4b06a5f4954a0d43eb8812dd165
                                 ^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                 slug           model ID (use this for API calls)
```

- Model metadata: `GET https://api.sketchfab.com/v3/models/{id}`
- Download links: `GET https://api.sketchfab.com/v3/models/{id}/download` (requires auth)
- Search: `GET https://api.sketchfab.com/v3/search?type=models&q={query}&downloadable=true`

### 3. Search poly.pizza (Fast Aggregator)

poly.pizza aggregates models from Google Poly archive, Sketchfab, and community uploads.
Good for quick keyword searches when you don't need API automation.

**Web search pattern:**
```
site:poly.pizza [object name] low poly
poly.pizza [object name] 3D model free download
```

**Direct URL pattern:** `https://poly.pizza/search/[keyword]`

- Results include GLB direct download links — no conversion needed
- Most models are CC-BY (attribution required) or CC0
- Filter by "Animated" if you need animations
- Each model page shows triangle count, vertex count, and a 3D preview

### 4. Search Kenney (Game-Focused, CC0)

Kenney provides complete asset packs, not individual models. Great for consistent art style.

**Web search pattern:**
```
site:kenney.nl [category] assets
kenney.nl [furniture/vehicle/nature] 3D
```

**Direct URL:** `https://kenney.nl/assets?q=3d`

- All CC0 — no attribution needed
- Consistent low-poly style across packs
- Downloads are zip files with multiple formats (GLTF included)

### 5. Search GitHub for Asset Packs

Many free asset packs live on GitHub, including KayKit.

**Web search pattern:**
```
github [object type] 3D model gltf CC0 free
github low-poly [category] asset pack
KayKit-Game-Assets github [pack name]
```

### 6. General Web Search

When the above sources don't have what you need:

**Web search patterns:**
```
[object name] 3D model free download gltf glb low poly
[object name] 3D asset CC0 free commercial use
[object name] game ready 3D model free
```

**Additional sources to check:**
- **Quaternius** (quaternius.com) — CC0 low-poly packs
- **OpenGameArt** (opengameart.org) — CC0/CC-BY game assets
- **Turbosquid** (turbosquid.com) — filter by Free + GLTF
- **CGTrader** (cgtrader.com) — filter by Free + Low Poly
- **itch.io** — search "3D assets" (many free/cheap packs)

### 7. AI-Generated / Procedural (Last Resort)

If no model exists, consider:
- Building it from primitives in Three.js (boxes, cylinders, spheres)
- Using Meshy.ai or similar AI 3D generators
- Commissioning from itch.io creators

---

## KayKit by Kay Lousberg

Free CC0-licensed low-poly 3D asset packs. Single gradient atlas texture (1024x1024).

### Packs & GitHub Repos

| Pack | Content | GitHub |
|------|---------|--------|
| **Furniture Bits** | 50+ furniture, desks, chairs, beds, shelves | `KayKit-Game-Assets/KayKit-Furniture-Bits-1.0` |
| **Furniture Bits EXTRA** | +20 computer/gaming setup items (monitor, keyboard, mouse, laptop, desk chair) | Paid ($3.95+) on [itch.io](https://kaylousberg.itch.io/furniture-bits) |
| **Character Pack** | Low-poly characters | `KayKit-Game-Assets/KayKit-Adventurers-1.0` |
| **Mini Game Kit** | Props, nature, buildings | `KayKit-Game-Assets/KayKit-Mini-Game-Kit-1.0` |
| **Prototype Bits** | 64+ generic shapes/props | `KayKit-Game-Assets/KayKit-Prototype-Bits-1.0` |

### File Structure in Repos

```
addons/kaykit_*/Assets/
├── gltf/       ← Use these (.gltf + .bin pairs)
├── fbx/
├── obj/
└── texture/    ← Atlas texture (furniturebits_texture.png)
```

### KayKit Download Workflow

1. Browse the GitHub repo's `Assets/gltf/` directory for model names
2. Download the `.gltf` + `.bin` pair (both required)
3. Convert to `.glb` (single binary) for web: `npx gltf-pipeline -i model.gltf -o model.glb`
4. Place in `modules/web-app/public/models/`
5. Use with `useGLTF('/models/model.glb')` from `@react-three/drei`

---

## File Format Priority

| Format | When to Use | Conversion |
|--------|-------------|------------|
| `.glb` | Preferred — single binary, fastest to load | Use directly |
| `.gltf` + `.bin` | Common in asset packs | `npx gltf-pipeline -i input.gltf -o output.glb` |
| `.gltf` + `.bin` (Draco) | Smaller files | `npx gltf-pipeline -i input.gltf -o output.glb -d` |
| `.fbx` | Some Sketchfab models | Convert with Blender or online tools |
| `.obj` | Last resort — no PBR | Convert with Blender |

---

## Post-Download Optimization (MANDATORY)

**Every model downloaded from Sketchfab or other external sources MUST be optimized before use.**
Sketchfab GLBs are typically 5-30MB with 1024x1024 textures and 100K+ vertices — far too heavy
for a web scene. The optimization pipeline below routinely achieves 80-96% file size reduction
with no visible quality loss at typical viewing distances.

### Inspect Before Optimizing

Always inspect the model first to understand what's eating space:

```bash
npx gltf-transform inspect public/models/myModel.glb
```

Key things to look for:
- **Texture resolution** — 1024x1024 or 2048x2048 is overkill for desk-scale objects; 256-512 is plenty
- **Texture format** — PNG textures are often 3-5x larger than WebP; JPEG is better but WebP wins
- **Vertex count** — >50K vertices for a desk ornament is excessive; simplify to 5-10K
- **Extra attributes** — TEXCOORD_1, TEXCOORD_2, TANGENT add significant data; prune if unused
- **Texture count** — baseColor + normal + metallicRoughness + specular = 4 textures that compress differently

### The Optimization Pipeline

Run these steps **in order** using separate commands (not `gltf-transform optimize`,
which uses its own defaults and can produce worse results):

```bash
MODEL="electricPiano"
ORIGINAL="/tmp/${MODEL}-original.glb"
DEST="modules/web-app/public/models/${MODEL}.glb"

# Step 1 — Resize textures (256 for small objects, 512 for hero objects)
npx gltf-transform resize "$ORIGINAL" /tmp/${MODEL}-s1.glb --width 256 --height 256

# Step 2 — Simplify geometry (ratio = target fraction, error = allowed deviation)
npx gltf-transform simplify /tmp/${MODEL}-s1.glb /tmp/${MODEL}-s2.glb --ratio 0.05 --error 0.02

# Step 3 — Convert textures to WebP (much smaller than PNG/JPEG)
npx gltf-transform webp /tmp/${MODEL}-s2.glb /tmp/${MODEL}-s3.glb

# Step 4 — Prune unused accessors, textures, materials
npx gltf-transform prune /tmp/${MODEL}-s3.glb /tmp/${MODEL}-s4.glb

# Step 5 — Draco mesh compression (ALWAYS last — decode is lossy if re-run)
npx gltf-transform draco /tmp/${MODEL}-s4.glb "$DEST"

# Step 6 — Generate gzip sidecar for nginx gzip_static
node -e "
const fs=require('fs'),zlib=require('zlib');
const data=fs.readFileSync('$DEST');
fs.writeFileSync('${DEST}.gz', zlib.gzipSync(data, {level:9}));
console.log('${MODEL}.glb:', (data.length/1024).toFixed(1)+'KB →',
  (fs.statSync('${DEST}.gz').size/1024).toFixed(1)+'KB gzipped');
"

# Clean up
rm -f /tmp/${MODEL}-s*.glb /tmp/${MODEL}-original.glb
```

### Optimization Guidelines by Object Role

| Role | Texture Size | Simplify Ratio | Expected Output |
|------|-------------|----------------|-----------------|
| Background/room | 256x256 | 0.1 | <100 KB |
| Desk-scale object (keyboard, mouse, plant) | 256x256 | 0.05-0.1 | <50 KB |
| Hero object (desk, piano) | 512x512 | 0.05 | 100-500 KB |
| Detailed prop (headset) with palette texture | Skip resize | 0.1 | 200-300 KB |

### Real-World Results

| Model | Source Size | After Pipeline | Wire (gzip) | Reduction |
|-------|-----------|---------------|-------------|-----------|
| standingDesk.glb | 1.8 MB | 87 KB | 80 KB | 96% |
| electricPiano.glb | 13.5 MB (Sketchfab GLB) | 500 KB | 390 KB | 97% |
| gamingHeadset.glb | 717 KB | 239 KB | 235 KB | 67% |

### Common Pitfalls

- **Do NOT use `gltf-transform optimize --compress draco` as a single step.** It runs its own
  simplify/weld/join pipeline with different defaults and can produce *larger* files than the
  step-by-step approach, especially on models that were already Draco-compressed.
- **Draco is always the LAST step.** If you need to re-optimize, start from the original
  (pre-Draco) file. Decoding and re-encoding Draco is lossy and often inflates the result.
- **Keep the original download** until you've verified the optimized version renders correctly.
- **Sketchfab GLBs often have 1024x1024 textures** even for small objects. These are the
  biggest size offender — resizing to 256x256 can cut 50-80% of file size alone.
- **Some models have redundant UV channels** (TEXCOORD_1, TEXCOORD_2) that `prune` will strip
  if no material references them.

## Checking Licenses

Before using any model, verify the license:

| License | Attribution? | Commercial? | Modify? |
|---------|-------------|-------------|---------|
| **CC0** | No | Yes | Yes |
| **CC-BY** | Yes (credit author) | Yes | Yes |
| **CC-BY-SA** | Yes + share-alike | Yes | Yes (same license) |
| **CC-BY-NC** | Yes | **No** | Yes |

For this project, prefer **CC0** or **CC-BY**. Add attribution in a comment or credits page for CC-BY models.

## All Sources (Quick Reference)

| Source | URL | License | API? | Best For |
|--------|-----|---------|------|----------|
| **Sketchfab** | sketchfab.com | Varies (filter CC0/CC-BY) | Yes (token) | Largest library, API download |
| **poly.pizza** | poly.pizza | CC-BY (mostly) | Yes (free) | Quick keyword search, direct GLB |
| **KayKit** | github.com/KayKit-Game-Assets | CC0 | No | Consistent low-poly game style |
| **Kenney** | kenney.nl/assets | CC0 | No | Complete themed packs |
| **Quaternius** | quaternius.com | CC0 | No | Low-poly themed packs |
| **OpenGameArt** | opengameart.org | CC0/CC-BY | No | Game-ready assets |
| **itch.io** | itch.io | Varies | No | Indie asset packs |
| **Three.js examples** | github.com/mrdoob/three.js | MIT | No | Reference/test models |

## Integration Pattern (React Three Fiber)

```tsx
import { useGLTF } from '@react-three/drei';

function Model({ url, ...props }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene.clone()} {...props} />;
}

// Preload for instant display
useGLTF.preload('/models/myModel.glb');
```

### Debugging Model Dimensions

```tsx
import { Box3, Vector3 } from 'three';

const box = new Box3().setFromObject(scene);
const size = new Vector3();
box.getSize(size);
console.log(`Size: ${size.x} × ${size.y} × ${size.z}`);
```

### Non-Uniform Scaling

KayKit models are often small. Scale them up, and use non-uniform `scale={[x, y, z]}`
to change proportions (e.g., make a square desk into a wide desk).

---

## Environment Variables

| Variable | Purpose | Where to Get |
|----------|---------|-------------|
| `SKETCHFAB_API_TOKEN` | Download models via Sketchfab API | sketchfab.com/settings/password → API Token |

Add to `.env.example` and `.env` per the env-vars workspace rule.

---

## Current Project Models

Located in `modules/web-app/public/models/`:

| File | Size (wire) | Source | License | Used For |
|------|-------------|--------|---------|----------|
| `desk.glb` | ~2 KB | KayKit Furniture EXTRA | CC0 | Wide desk (non-uniform scaled) |
| `chairDesk.glb` | ~3 KB | KayKit Furniture EXTRA | CC0 | Office chair |
| `computerScreen.glb` | ~1 KB | KayKit Furniture EXTRA | CC0 | Monitor |
| `computerKeyboard.glb` | ~1 KB | KayKit Furniture EXTRA | CC0 | Keyboard |
| `computerMouse.glb` | ~1 KB | KayKit Furniture EXTRA | CC0 | Mouse |
| `laptop.glb` | ~1 KB | KayKit Furniture EXTRA | CC0 | Laptop |
| `speakerSmall.glb` | ~2 KB | KayKit Furniture EXTRA | CC0 | Speaker |
| `pottedPlant.glb` | ~2 KB | KayKit Furniture Bits | CC0 | Plant |
| `lampRoundTable.glb` | ~1 KB | KayKit Furniture Bits | CC0 | Table lamp |
| `emptyRoom.glb` | ~1 KB | KayKit Furniture Bits | CC0 | Room shell |
| `standingDesk.glb` | 80 KB | Sketchfab (Ryan_Nein) | CC-BY | Standing desk (optimized: 1.8MB→87KB) |
| `electricPiano.glb` | 390 KB | [Sketchfab (Mateusz Woliński)](https://sketchfab.com/3d-models/electric-piano-49f379cced99484b8cfb69e0d9ca1bc0) | CC-BY | Electric piano (optimized: 13.5MB→500KB) |
| `gamingHeadset.glb` | 235 KB | Sketchfab | CC-BY | Gaming headset (optimized: 717KB→239KB) |

**Note:** KayKit models are already tiny (<5KB) since they use a shared palette texture. Sketchfab
models need the full optimization pipeline (see above) — their raw downloads are 10-100x larger.
