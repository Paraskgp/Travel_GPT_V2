import { callLLM, Provider } from "../llm/client"
import {
  clusterAssignmentSystemPrompt,
  clusterAssignmentUserPrompt,
  clusterTravelSystemPrompt,
  clusterTravelUserPrompt,
} from "../claude/prompts"
import {
  ClusterAssignmentResult,
  ClusterResult,
  ClusterTravelPair,
  ClusterTravelResult,
  Experience,
  ExperienceCluster,
  Theme,
} from "../types"
import { parseJSON } from "../utils/parse-json"

const TRAVEL_PAIR_BATCH_SIZE = 60

export async function generateGeographicClusters(
  destination: string,
  themes: Theme[],
  provider: Provider = "openai"
): Promise<ClusterResult | undefined> {
  try {
    console.log("[pipeline/geographic-clustering] Stage A: cluster assignment...")
    const assignmentRaw = await callLLM(
      clusterAssignmentSystemPrompt(),
      clusterAssignmentUserPrompt({ destination, themes }),
      provider
    )
    const assignment = parseJSON<ClusterAssignmentResult>(assignmentRaw)
    const clusters = repairClusterAssignmentCoverage(themes, assignment.clusters)
    logClusterAssignmentCoverage(themes, clusters)

    const pairRequests = buildClusterPairRequests(clusters)
    console.log(`[pipeline/geographic-clustering] Stage B: cluster travel estimates (${pairRequests.length} pairs)...`)
    const pairs: ClusterTravelPair[] = []
    for (let i = 0; i < pairRequests.length; i += TRAVEL_PAIR_BATCH_SIZE) {
      const batch = pairRequests.slice(i, i + TRAVEL_PAIR_BATCH_SIZE)
      const batchNumber = Math.floor(i / TRAVEL_PAIR_BATCH_SIZE) + 1
      const batchCount = Math.ceil(pairRequests.length / TRAVEL_PAIR_BATCH_SIZE)
      console.log(`[pipeline/geographic-clustering] travel batch ${batchNumber}/${batchCount}: ${batch.length} pairs`)
      const travelRaw = await callLLM(
        clusterTravelSystemPrompt(),
        clusterTravelUserPrompt(destination, clusters, batch),
        provider
      )
      const travel = parseJSON<ClusterTravelResult>(travelRaw)
      pairs.push(...alignTravelPairs(batch, travel.pairs))
    }

    console.log(`[pipeline/geographic-clustering] done: ${clusters.length} clusters, ${pairs.length} pairs`)
    return { clusters, pairs }
  } catch (err) {
    console.warn("[pipeline/geographic-clustering] failed — board will continue without clusters:", err)
    return undefined
  }
}

export function buildClusterPairRequests(
  clusters: ExperienceCluster[]
): Array<Pick<ClusterTravelPair, "from_cluster_id" | "to_cluster_id">> {
  const pairs: Array<Pick<ClusterTravelPair, "from_cluster_id" | "to_cluster_id">> = []
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      pairs.push({
        from_cluster_id: clusters[i].id,
        to_cluster_id: clusters[j].id,
      })
    }
  }
  return pairs
}

function alignTravelPairs(
  requested: Array<Pick<ClusterTravelPair, "from_cluster_id" | "to_cluster_id">>,
  received: ClusterTravelPair[]
): ClusterTravelPair[] {
  const byKey = new Map(received.map(pair => [pairKey(pair), pair]))
  return requested.map(request => {
    const pair = byKey.get(pairKey(request))
    if (!pair) {
      throw new Error(`Missing cluster travel pair: ${request.from_cluster_id} -> ${request.to_cluster_id}`)
    }
    return {
      from_cluster_id: request.from_cluster_id,
      to_cluster_id: request.to_cluster_id,
      walk_min: Number.isFinite(pair.walk_min) ? pair.walk_min : 999,
      drive_min: Number.isFinite(pair.drive_min) ? pair.drive_min : 60,
      mode: pair.mode,
      note: pair.note ?? null,
    }
  })
}

function pairKey(pair: Pick<ClusterTravelPair, "from_cluster_id" | "to_cluster_id">): string {
  return `${pair.from_cluster_id}::${pair.to_cluster_id}`
}

function repairClusterAssignmentCoverage(
  themes: Theme[],
  clusters: ExperienceCluster[]
): ExperienceCluster[] {
  const experiences = themes.flatMap(theme => theme.experiences)
  const byId = new Map(experiences.map(exp => [exp.id, exp]))
  const seen = new Set<string>()
  const repaired: ExperienceCluster[] = []

  for (const cluster of clusters) {
    const experienceIds = cluster.experience_ids.filter(id => {
      if (!byId.has(id) || seen.has(id)) return false
      seen.add(id)
      return true
    })
    if (experienceIds.length === 0) continue

    repaired.push({
      ...cluster,
      anchor_id: experienceIds.includes(cluster.anchor_id) ? cluster.anchor_id : experienceIds[0],
      experience_ids: experienceIds,
    })
  }

  const missing = experiences.filter(exp => !seen.has(exp.id))
  if (missing.length > 0) {
    console.warn("[pipeline/geographic-clustering] repairing omitted cluster assignments:", missing.map(exp => exp.id))
    for (const exp of missing) {
      repaired.push(singletonCluster(exp, repaired))
    }
  }

  return repaired
}

function singletonCluster(exp: Experience, existing: ExperienceCluster[]): ExperienceCluster {
  const existingIds = new Set(existing.map(cluster => cluster.id))
  let id = `cluster-${exp.id}`
  let suffix = 2
  while (existingIds.has(id)) {
    id = `cluster-${exp.id}-${suffix}`
    suffix++
  }

  return {
    id,
    name: exp.location_hint || exp.name,
    anchor_id: exp.id,
    experience_ids: [exp.id],
    zone: exp.location_hint || exp.name,
    cluster_note: "Singleton cluster added because the assignment pass omitted this experience.",
  }
}

function logClusterAssignmentCoverage(
  themes: Theme[],
  clusters: ExperienceCluster[]
): void {
  const expected = themes.flatMap(theme => theme.experiences.map(exp => exp.id))
  const expectedSet = new Set(expected)
  const assigned = clusters.flatMap(cluster => cluster.experience_ids)
  const assignedSet = new Set(assigned)
  const missing = expected.filter(id => !assignedSet.has(id))
  const duplicates = assigned.filter((id, index) => assigned.indexOf(id) !== index)
  const unknown = assigned.filter(id => !expectedSet.has(id))

  if (missing.length || duplicates.length || unknown.length) {
    console.warn("[pipeline/geographic-clustering] coverage warning:", {
      expected: expected.length,
      assigned: assigned.length,
      uniqueAssigned: assignedSet.size,
      missing: missing.length,
      duplicates: duplicates.length,
      unknown: unknown.length,
      missing_ids: missing.slice(0, 20),
    })
  }
}
