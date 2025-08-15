import { FileInfo } from './file-discovery'

export interface SearchResult {
  file: FileInfo
  score: number
  matchedText: string
}

export class FuzzySearch {
  search(query: string, files: FileInfo[], limit = 10): SearchResult[] {
    if (!query.trim()) {
      // Return all files when query is empty, sorted by name
      return files
        .map((file) => ({
          file,
          score: 0.5,
          matchedText: file.name,
        }))
        .sort((a, b) => a.file.name.localeCompare(b.file.name))
        .slice(0, limit)
    }

    const results: SearchResult[] = []
    const lowerQuery = query.toLowerCase()

    for (const file of files) {
      const score = this.calculateScore(lowerQuery, file)
      if (score > 0) {
        results.push({
          file,
          score,
          matchedText: file.name,
        })
      }
    }

    // Sort by score (descending) and then by name
    return results
      .sort((a, b) => {
        if (Math.abs(a.score - b.score) < 0.001) {
          return a.file.name.localeCompare(b.file.name)
        }
        return b.score - a.score
      })
      .slice(0, limit)
  }

  private calculateScore(query: string, file: FileInfo): number {
    const fileName = file.name.toLowerCase()
    const relativePath = file.relativePath.toLowerCase()

    // Exact filename match gets highest score
    if (fileName === query) {
      return 1.0
    }

    // Exact filename start match
    if (fileName.startsWith(query)) {
      return 0.9
    }

    // Filename contains query
    if (fileName.includes(query)) {
      return 0.8 - (fileName.indexOf(query) * 0.1) / fileName.length
    }

    // Check for fuzzy match in filename
    const fileNameFuzzyScore = this.fuzzyMatch(query, fileName)
    if (fileNameFuzzyScore > 0) {
      return 0.7 * fileNameFuzzyScore
    }

    // Path contains query
    if (relativePath.includes(query)) {
      return 0.6 - (relativePath.indexOf(query) * 0.1) / relativePath.length
    }

    // Check for fuzzy match in path
    const pathFuzzyScore = this.fuzzyMatch(query, relativePath)
    if (pathFuzzyScore > 0) {
      return 0.5 * pathFuzzyScore
    }

    // No match
    return 0
  }

  private fuzzyMatch(query: string, text: string): number {
    let queryIndex = 0
    let textIndex = 0
    let matches = 0
    let consecutiveMatches = 0
    let maxConsecutive = 0

    while (queryIndex < query.length && textIndex < text.length) {
      if (query[queryIndex] === text[textIndex]) {
        matches++
        consecutiveMatches++
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches)
        queryIndex++
      } else {
        consecutiveMatches = 0
      }
      textIndex++
    }

    // If we didn't match all query characters, no match
    if (queryIndex < query.length) {
      return 0
    }

    // Score based on percentage of matches and consecutive match bonus
    const matchRatio = matches / query.length
    const consecutiveBonus = maxConsecutive / query.length
    const lengthPenalty = query.length / text.length

    return matchRatio * 0.7 + consecutiveBonus * 0.2 + lengthPenalty * 0.1
  }
}