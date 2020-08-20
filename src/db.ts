import Path from 'path';
import Fs from 'fs';
import { Suggestion, ArticleSuggestion } from './models';

const filepath = Path.resolve(Path.join('..', 'db.json'))

interface Db {
  [key: string]: any[];
  suggestions: Suggestion[]
}

const _getDbFile = (): Db => {
  if (Fs.existsSync(filepath)) {
    return JSON.parse(Fs.readFileSync(filepath).toString()) as Db
  } else {
    Fs.writeFileSync(filepath, JSON.stringify({}))
    return {
      suggestions: []
    }
  }
}

const _saveDbFile = (objs: any, db: any) => {
  const newDb = { ...db }
  Object.keys(objs).forEach(key => {
    newDb[key] = objs[key]
  })
  Fs.writeFileSync(filepath, JSON.stringify(newDb, null, 2))
}

function getSuggestions(db = _getDbFile()): Suggestion[] {
  const suggestions = db.suggestions || []
  return suggestions.map(s => {
    s.suggestedAt = s.suggestedAt.map(s => new Date(s))
    return s
  })
}

function findSuggestion(opts: ArticleSuggestion, db: Db = _getDbFile()) {
  if (!db.suggestions) return null
  const suggestion = db.suggestions.find(s => s.tag === opts.tag && s.url === opts.url)
  if (suggestion) {
    suggestion.suggestedAt = suggestion.suggestedAt.map(s => new Date(s))
  }
  return suggestion
}

function saveSuggestion(opts: ArticleSuggestion, db = _getDbFile()) {
  const existing = findSuggestion(opts, db)

  if (existing) {
    return existing
  }

  const suggestions = db.suggestions || []
  const suggestion: Suggestion = {
    ...opts,
    id: suggestions.length + 1,
    suggestedAt: [new Date()]
  }
  suggestions.push(suggestion)

  _saveDbFile({ suggestions }, db)

  return suggestion
}

function findSuggestionById(id: number, db = _getDbFile()) {
  return db.suggestions ? db.suggestions.find(s => s.id === id) : null
}

function updateSuggestionDate(id: number, db = _getDbFile()) {
  const suggestions = db.suggestions
  const suggestionIndex = suggestions.findIndex(s => s.id === id)
  if (suggestionIndex < 0) throw new Error(`Cannot find suggestion for ID: ${id}`)

  suggestions[suggestionIndex].suggestedAt.push(new Date())

  _saveDbFile({
    suggestions
  }, db)
}

export const dbService = {
  getSuggestions,
  findSuggestion,
  saveSuggestion,
  updateSuggestionDate,
  findSuggestionById
};