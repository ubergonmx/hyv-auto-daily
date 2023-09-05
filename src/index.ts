/**
 * Welcome to Cloudflare Workers! This is your first scheduled worker.
 *
 * - Run `wrangler dev --local` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/cdn-cgi/mf/scheduled"` to trigger the scheduled event
 * - Go back to the console to see what your worker has logged
 * - Update the Cron trigger in wrangler.toml (see https://developers.cloudflare.com/workers/wrangler/configuration/#triggers)
 * - Run `wrangler deploy --name my-worker` to deploy your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/runtime-apis/scheduled-event/
 */

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	DISCORD_WEBHOOK:string, ACCOUNT_COOKIE:string, DISCORD_USER_ID:string
}

enum HoyoverseAPI {
	GENSHIN = "https://sg-hk4e-api.hoyolab.com/event/sol/sign?lang=en-us&act_id=e202102251931481",
	HSR = "https://sg-public-api.hoyolab.com/event/luna/os/sign?lang=en-us&act_id=e202303301540311",
}

interface DiscordPayload {
	username: string;
	avatarURL: string;
	content: string;
}

interface Game {
	name: string;
	url: HoyoverseAPI;
	discordPayload: DiscordPayload
	successMessage?(): string;
	failedMessage?(): string;
	claimedAlreadyMessage?(): string;
}

const games: Game[] = [
	{
		name: "Genshin Impact",
		url: HoyoverseAPI.GENSHIN,
		discordPayload: {
			username: "Genshin Impact Check-In",
			avatarURL: "https://upload-os-bbs.hoyolab.com/upload/2021/08/31/141033342/8fae6ff523cf0eb911df33e08fbb3f81_6839218126942510885.jpg",
			content: ""
		},
		successMessage(): string {
			const voiceLines = [
				"What do we have here...",
				"I can put these to good use.",
			];
			return `Successfully checked in!\n\n *${getRandom(voiceLines)}*`;
		}
	},
	{
		name: "Honkai Star Rail",
		url: HoyoverseAPI.HSR,
		discordPayload: {
			username: "Honkai Star Rail Check-In",
			avatarURL: "https://upload-os-bbs.hoyolab.com/upload/2023/03/14/145173938/214a8d73665c28493289c76d1ef31a91_5039956508100338870.jpg?x-oss-process=image/resize,s_1000/quality,q_80/auto-orient,0/interlace,1/format,jpg",
			content: ""
		},
		successMessage(): string {
			const voiceLines = [
				"Hmm. We can use it.",
				"Not bad.",
			];
			return `Successfully claimed daily rewards!\n\n *${getRandom(voiceLines)}*`;
		}
	}
]

function getRandom(arr:any[]):any{
	return arr[Math.floor(Math.random() * arr.length)];
}

export default {
	async scheduled(
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext
	): Promise<void> {
		console.log(controller.scheduledTime, controller.cron);
		const performCheckIn = async () => {
			for (let game of games){
				console.log("Checking in for ", game.name);
				await autoDailyCheckIn(game, env);
			}
		}
		ctx.waitUntil(performCheckIn());
	},
	async fetch(request:Request, env:Env, context:ExecutionContext) : Promise<Response>{
		let result = "Personal auto daily check-in every 12 AM";
		if(request.url.includes("now")){
			const performCheckIn = async () => {
				for (let game of games){
					console.log("Checking in for ", game.name);
					await autoDailyCheckIn(game, env, false);
				}
			}

			context.waitUntil(performCheckIn());
		}
		return new Response(result, { status: 200 });
	},
};

async function autoDailyCheckIn(
	game:Game, 
	{DISCORD_WEBHOOK:webhook, ACCOUNT_COOKIE:cookie, DISCORD_USER_ID:userId} : Env,
	isSilent:boolean = true
){	
	await checkIn(game, cookie, userId, isSilent);
	console.log("Checked in status: ", game.discordPayload.content);
	await notifyDiscordWebhook(webhook, game.discordPayload);
}

async function checkIn(game:Game, cookie:string, userId:string, isSilent:boolean = true){
	let result = "";
	await fetch(game.url, {
		method: 'POST',
		headers: {
			"Cookie": `${cookie}`
		},
	})
	.then(res => res.text())
	.then((data:any) => {result = JSON.parse(data).message});
	
	game.discordPayload.content = isSilent ? "[Silent Notification]\n" : `<@${userId}>\n` ;
	game.discordPayload.content += (!result || result === "") ? "Failed to check in" 
	: (result === "OK") ? game.successMessage!() 
	: `*${result}*`;
}

async function notifyDiscordWebhook(
	webhook:string,
	{ username, avatarURL, content }:DiscordPayload
):Promise<void>{
	let payload = JSON.stringify({
		"username": username,
		"avatar_url": avatarURL,
		"content": content
	});
	
	await fetch(webhook, {
		method: 'POST',
		headers: {
			"Content-Type": "application/json"
		},
		body: payload
	})
	.then(res => res.text())
	.then(text => console.log("[Notified Discord]",text));
}