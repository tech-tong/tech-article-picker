import { DateTime } from "luxon";
import { config } from "./configs";
import { dbService } from "./db";
import { Suggestion } from "./models";
import { PointerIoService } from "./services/PointerIoService";

async function run(maxRetries: number = config.maxRetries): Promise<Suggestion> {
  if (maxRetries === 0) throw new Error('Ran out of retries');

  const article = await PointerIoService.getRandomArticle()

  let existingSuggestion = dbService.findSuggestion(article)

  if (!existingSuggestion) {
    return dbService.saveSuggestion(article)
  }

  const lastSuggestedAt = existingSuggestion.suggestedAt.sort((a, b) => a.getTime() - b.getTime()).pop()!
  if (-DateTime.fromJSDate(lastSuggestedAt).diffNow('days').days > config.minRecycleDays) {
    existingSuggestion.suggestedAt.push(new Date())
    dbService.saveSuggestion(existingSuggestion)
    return existingSuggestion
  }

  return run(--maxRetries)
}

run().then(result => {
  console.log(result)
  //@ts-ignore
  process.exit(0)
}).catch(err => {
  console.error(err)
  //@ts-ignore
  process.exit(1)
})