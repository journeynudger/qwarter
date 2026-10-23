import storiesData from "@/content/stories.json";

export type StoryImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  source: string;
  originalUrl: string;
  credit?: string;
};

export type StoryBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; id: string }
  | { type: "image"; image: number };

export type Story = {
  id: number;
  slug: string;
  title: string;
  headline: string[];
  company: string;
  category: string;
  lesson: string;
  excerpt: string;
  minutes: number;
  isExcerpt: boolean;
  source: { label: string; url?: string; detail?: string };
  provenance: string;
  hero: number;
  images: StoryImage[];
  blocks: StoryBlock[];
};

export const getStories = (): Story[] => storiesData as Story[];
export const getStory = (slug: string): Story | undefined => getStories().find((story) => story.slug === slug);
export const storyUrl = (story: Story) => `/stories/${story.slug}/`;
export const storyImage = (story: Story) => story.images[story.hero] ?? story.images[0];
export const storyCategories = ["All stories", "Brand", "Craft", "Direction", "Growth", "Resilience"];
export const featuredStories = () => [21, 7, 19].map((id) => getStories().find((story) => story.id === id)!);

export function roman(value: number): string {
  const numerals: [number, string][] = [[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let result = "";
  for (const [number, numeral] of numerals) {
    while (value >= number) { result += numeral; value -= number; }
  }
  return result;
}
