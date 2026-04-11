# The Bigger Picture

## Vision

Make objective gait analysis accessible to every child who needs it, everywhere in the world, at zero cost.

## Where we are now (v1)

- Single-phone pose estimation using MediaPipe BlazePose
- 2D analysis from side and front camera angles
- Core gait metrics: joint angles, symmetry indices, stride cadence
- Session recording, storage, and sharing via Supabase
- Mobile-first PWA — works on any phone with a camera

## Where this can go

### Near-term (v2)

**Multi-device synchronized recording**
- Two phones record simultaneously (front + side) with a shared session code
- Time-synchronized playback and combined analysis
- Side view captures sagittal plane (knee flexion, hip extension, stride length)
- Front view captures frontal plane (lateral sway, knee valgus, foot placement width)

**AI-powered insights (Gemma / local models)**
- Natural language session summaries: "Left knee flexion improved 12% over 3 weeks"
- Pattern recognition across sessions that raw metrics might miss
- Therapist-friendly reports that translate numbers into actionable guidance
- Anomaly detection: flag unusual sessions automatically

**Therapist dashboard**
- Web dashboard for therapists managing multiple patients
- Aggregate views across their patient roster
- Export reports for clinical records
- Treatment plan integration

### Medium-term (v3)

**Exercise guidance**
- Based on detected asymmetries, suggest specific exercises
- Video demonstrations of recommended stretches and strengthening
- Track exercise compliance alongside gait metrics

**Benchmark data**
- Anonymous, aggregated data across users (with consent) to build reference ranges
- "Your child's knee symmetry is in the 60th percentile for their age and condition"
- Help therapists calibrate expectations

**Wearable integration**
- Complement camera data with IMU data from smartwatches or phone-in-pocket
- Continuous background monitoring during daily activities (not just formal sessions)

### Long-term

**Beyond cerebral palsy**
- Stroke rehabilitation gait recovery
- Post-surgical recovery (hip/knee replacement)
- Elderly fall risk assessment
- Sports injury rehabilitation
- Parkinson's disease gait monitoring

**Clinical validation**
- Partner with physiotherapy departments for validation studies
- Compare our metrics against gold-standard motion capture
- Publish accuracy benchmarks
- Seek regulatory pathways if applicable

## Design principles

1. **Accessible first** — if a parent in a rural village can't use it on a budget phone, it's not accessible enough
2. **Data belongs to the family** — they own it, they control who sees it, they can export or delete it anytime
3. **Complement, don't replace** — this tool supports therapists, it doesn't replace clinical judgment
4. **Measure what matters** — every metric we add must answer the question "is the child's walking getting better?"
5. **Privacy by design** — video stays on-device, only pose data (stick figures, angles) is stored server-side

## Why this matters at scale

There are approximately 17 million people living with cerebral palsy worldwide. The vast majority do not have access to clinical gait analysis labs. Many don't have access to regular physiotherapy at all.

A free, phone-based tool that provides even basic objective measurement could:
- Help parents in underserved areas understand their child's condition better
- Enable remote physiotherapy consultation with shared data
- Create the first large-scale dataset of CP gait patterns (with consent), advancing research
- Reduce the cost and friction of monitoring therapy effectiveness

The technology exists today. The phones are already in people's pockets. The gap is just the software connecting them.
