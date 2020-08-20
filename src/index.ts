import { JSDOM } from 'jsdom'
import got from 'got'
import { DateTime } from 'luxon';
import { config } from './configs'
import { dbService } from './db'
import { Suggestion } from './db/models';

const POINTER_BASE_URL = 'http://www.pointer.io'
const POINTER_ARCHIVES_URL = `${POINTER_BASE_URL}/archives/`

const getTagUrl = (tag: string) => `http://www.pointer.io/tags/${tag.toLowerCase().replace(/\s/g, '-')}`

function _parsePointerIssueList(dom: JSDOM) {
  const archiveDivs = dom.window.document.querySelectorAll('.archive-page-issue-div');
  const list: {
    issueNumber: number;
    issueDate: Date;
    issueURL: string;
  }[] = []
  archiveDivs.forEach((a) => {
    const issueNumber = a.childNodes[1].textContent
    const issueDate = a.childNodes[5].textContent
    const issueUrl = a.children[0].getAttribute('href')

    if (issueNumber && issueDate && issueUrl) {
      list.push({
        issueNumber: Number(issueNumber.trim().split('Issue #').pop()),
        issueDate: new Date(issueDate),
        issueURL: `${POINTER_BASE_URL}${issueUrl}`
      })
    }
  })
  return list
}

interface Article {
  title: string;
  author: string | null;
  url: string;
  tags: string[];
  tldr: string;
}

function _parseArticlesFromPointerIssue(dom: JSDOM) {
  const articles = Array.from(
    dom.window.document.querySelectorAll('.mcnTextContentContainer td')
  ).filter(div => {
    const text = div.textContent!.trim()
    const titleLink = div.querySelector('.mcnTextContentContainer a strong')
    return text && titleLink;
  }).reduce<Article[]>((a, div) => {
    const divs = Array.from(div.querySelectorAll('div,span'))
      .filter(d => d.textContent!.trim())

    const url = divs[0].querySelector('a')!.getAttribute('href')!
    const [title, author] = divs[0].textContent!
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
    const map = {
      [title]: true,
      [author]: true
    }
    const otherContents = divs.slice(1).reduce<string[]>((m, div) => {
      div.textContent!
        .split('\n')
        .map(t => t.trim())
        .filter(Boolean)
        .forEach(row => {
          if (!map[row]) {
            map[row] = true
            m.push(row)
          }
        })
      return m
    }, [])

    const tags = otherContents[0]
      .replace(/#/g, '')
      .split(' ')

    const tldr = otherContents.slice(1).reduce((s, d) => {
      return s + d + '\n'
    }, '')

    a.push({
      title,
      author: author ? author.replace('-', '').trim() : null,
      url,
      tags,
      tldr
    })
    return a
  }, [])
  return articles
}

async function getPointerIssueList() {
  const response = await got(POINTER_ARCHIVES_URL)
  const dom = new JSDOM(response.body);
  return _parsePointerIssueList(dom);
}

async function getPointerArticlesFromIssue(issueUrl: string) {
  const response = await got(issueUrl)
  const dom = new JSDOM(response.body);
  return _parseArticlesFromPointerIssue(dom)
}

function getRandomFromArray(arr: any[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function getRandomArticle() {
  const randomTag = getRandomFromArray(config.relevantTags)
  const url = getTagUrl(randomTag)

  const response = await got(url)
  const dom = new JSDOM(response.body);
  const links = Array.from(
    dom.window.document.querySelectorAll('.content-block')
  ).map((div) => {
    const link = div.querySelector('.article-header a')
    return link!.getAttribute('href')
  })

  const randomLink = getRandomFromArray(links);

  return {
    tag: randomTag,
    url: randomLink
  }
}

async function run(maxRetries: number = config.maxRetries): Promise<Suggestion> {
  if (maxRetries === 0) throw new Error('Ran out of retries');

  let article = await getRandomArticle()

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