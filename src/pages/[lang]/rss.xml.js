import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE } from "../../consts";

export async function getStaticPaths() {
	return [{ params: { lang: "en" } }, { params: { lang: "nl" } }];
}

export async function GET(context) {
	const posts = await getCollection("blog");
	const locale = context.params?.lang || "en";
	const baseUrl = context.site;

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: baseUrl,
		items: posts.map((post) => ({
			...post.data,
			link: `/${locale}/blog/${post.id}/`,
		})),
		customData: `<language>${locale}</language>`,
	});
}
