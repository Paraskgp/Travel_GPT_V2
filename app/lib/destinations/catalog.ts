export type DestinationCategory = 'city' | 'national_park' | 'unesco'

export interface DestinationOption {
  id: string
  name: string
  category: DestinationCategory
  region: string
  imageUrl: string
  imageAlt: string
  headline: string
  pointOfView: string
  bestFor: string[]
  planningBias: string
}

export const DESTINATION_CATEGORY_LABELS: Record<DestinationCategory, string> = {
  city: 'Cities',
  national_park: 'National Parks',
  unesco: 'UNESCO Sites',
}

export const DESTINATION_OPTIONS: DestinationOption[] = [
  {
    id: 'tokyo-japan',
    name: 'Tokyo, Japan',
    category: 'city',
    region: 'Kanto, Japan',
    imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Tokyo street crossing with illuminated signs at dusk',
    headline: 'Layered neighborhoods, serious food, and precise transit days.',
    pointOfView: 'Best when the plan treats Tokyo as clusters of moods, not a checklist of landmarks.',
    bestFor: ['Food', 'Culture', 'Transit-first'],
    planningBias: 'Neighborhood arcs',
  },
  {
    id: 'kyoto-japan',
    name: 'Kyoto, Japan',
    category: 'city',
    region: 'Kansai, Japan',
    imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Traditional Kyoto street with pagoda at sunset',
    headline: 'Temples, craft, gardens, and early starts that actually matter.',
    pointOfView: 'The right Kyoto trip protects quiet hours and avoids treating every temple as equal.',
    bestFor: ['Heritage', 'Slow mornings', 'Design'],
    planningBias: 'Early anchors',
  },
  {
    id: 'seattle-washington',
    name: 'Seattle, Washington',
    category: 'city',
    region: 'Pacific Northwest, USA',
    imageUrl: 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Seattle skyline with Space Needle and Mount Rainier in the distance',
    headline: 'Markets, ferries, coffee, water views, and mountain weather calls.',
    pointOfView: 'Seattle works best when city days leave room for water, hills, and weather pivots.',
    bestFor: ['Food', 'Views', 'Day trips'],
    planningBias: 'Weather-aware',
  },
  {
    id: 'paris-france',
    name: 'Paris, France',
    category: 'city',
    region: 'Ile-de-France, France',
    imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Paris skyline with the Eiffel Tower at sunset',
    headline: 'Museums, walks, bakeries, and neighborhoods with strong opinions.',
    pointOfView: 'A good Paris plan alternates icons with smaller neighborhood rituals.',
    bestFor: ['Museums', 'Food', 'Walking'],
    planningBias: 'Icon plus ritual',
  },
  {
    id: 'yellowstone-national-park',
    name: 'Yellowstone National Park',
    category: 'national_park',
    region: 'Wyoming, Montana, Idaho',
    imageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Boardwalk through a geothermal landscape at golden hour',
    headline: 'Geyser basins, wildlife windows, long drives, and base-camp discipline.',
    pointOfView: 'Yellowstone punishes over-scheduling; the best plans respect distance and dawn.',
    bestFor: ['Wildlife', 'Geology', 'Families'],
    planningBias: 'Drive-time honesty',
  },
  {
    id: 'zion-national-park',
    name: 'Zion National Park',
    category: 'national_park',
    region: 'Utah, USA',
    imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Red canyon walls and a winding river in a national park',
    headline: 'Canyon light, shuttle logistics, iconic hikes, and easier alternatives.',
    pointOfView: 'Zion needs access rules and effort tiers up front, not after the itinerary is drafted.',
    bestFor: ['Hiking', 'Scenery', 'Adventure'],
    planningBias: 'Access-first',
  },
  {
    id: 'grand-canyon-south-rim',
    name: 'Grand Canyon National Park, South Rim',
    category: 'national_park',
    region: 'Arizona, USA',
    imageUrl: 'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Grand Canyon layers seen from the rim at sunset',
    headline: 'Rim viewpoints, sunrise timing, desert pacing, and regional side trips.',
    pointOfView: 'The South Rim is strongest when the plan knows when to stop driving and just watch light move.',
    bestFor: ['Views', 'Families', 'Road trips'],
    planningBias: 'Light windows',
  },
  {
    id: 'yosemite-national-park',
    name: 'Yosemite National Park',
    category: 'national_park',
    region: 'California, USA',
    imageUrl: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Yosemite valley with granite cliffs and pine forest',
    headline: 'Granite walls, waterfall seasons, valley crowds, and trail tradeoffs.',
    pointOfView: 'Yosemite planning is really about seasonality, parking, and choosing the right effort level.',
    bestFor: ['Hiking', 'Photography', 'Nature'],
    planningBias: 'Season-led',
  },
  {
    id: 'machu-picchu-peru',
    name: 'Machu Picchu, Peru',
    category: 'unesco',
    region: 'Cusco Region, Peru',
    imageUrl: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Machu Picchu terraces and mountain landscape',
    headline: 'Sacred Valley logistics, altitude, timed entries, and ruins with context.',
    pointOfView: 'Machu Picchu is better when the surrounding valley is treated as part of the experience.',
    bestFor: ['Heritage', 'Landscape', 'Bucket list'],
    planningBias: 'Altitude-aware',
  },
  {
    id: 'petra-jordan',
    name: 'Petra, Jordan',
    category: 'unesco',
    region: 'Ma-an Governorate, Jordan',
    imageUrl: 'https://images.unsplash.com/photo-1579606032821-4e6161c81bd3?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Petra Treasury carved into rose-colored sandstone',
    headline: 'Rose sandstone, long walks, heat strategy, and the right reveal order.',
    pointOfView: 'Petra should be paced like an archaeological landscape, not a single photo stop.',
    bestFor: ['History', 'Walking', 'Desert'],
    planningBias: 'Heat-smart',
  },
  {
    id: 'great-barrier-reef-australia',
    name: 'Great Barrier Reef, Australia',
    category: 'unesco',
    region: 'Queensland, Australia',
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Clear tropical water over coral reef',
    headline: 'Reef days, island bases, weather windows, and conservation-minded choices.',
    pointOfView: 'The Reef needs conditions, operator choice, and recovery time treated as real constraints.',
    bestFor: ['Marine life', 'Islands', 'Families'],
    planningBias: 'Conditions-first',
  },
  {
    id: 'angkor-cambodia',
    name: 'Angkor Archaeological Park, Cambodia',
    category: 'unesco',
    region: 'Siem Reap, Cambodia',
    imageUrl: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Stone temple towers at Angkor in warm light',
    headline: 'Temple circuits, sunrise pressure, heat breaks, and quiet secondary ruins.',
    pointOfView: 'Angkor is at its best when the famous temples are balanced with shade, timing, and restraint.',
    bestFor: ['History', 'Photography', 'Architecture'],
    planningBias: 'Circuit pacing',
  },
]

export function getDestinationByName(name: string): DestinationOption | undefined {
  return DESTINATION_OPTIONS.find(destination => destination.name === name)
}
