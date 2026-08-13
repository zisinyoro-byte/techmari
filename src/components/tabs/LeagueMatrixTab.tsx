'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { TrafficCone, RefreshCw, Filter, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react'

// --- Types ---

type Light = 'GREEN' | 'YELLOW' | 'RED'

interface MarketCell {
  light: Light
  roi: number | null
  brier: number | null
  calibration: number | null
  accuracy: number | null
  totalMatches: number
  totalBets60: number
  hitRate: number | null
  reason: string
}

interface LeagueRow {
  league: string
  name: string
  country: string
  totalMatches: number
  markets: Record<string, MarketCell>
}

const MARKETS = ['O2.5', 'BTTS', 'O3.5', '1X2'] as const
type Market = (typeof MARKETS)[number]

// --- Helpers ---

const LIGHT_CONFIG: Record<Light, { bg: string; text: string; border: string; dot: string; label: string }> = {
  GREEN: { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-800 dark:text-emerald-200', border: 'border-emerald-300 dark:border-emerald-700', dot: 'bg-emerald-500', label: 'Full Stakes' },
  YELLOW: { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-300 dark:border-amber-700', dot: 'bg-amber-500', label: 'Half Stakes / Monitor' },
  RED: { bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-800 dark:text-red-200', border: 'border-red-300 dark:border-red-700', dot: 'bg-red-500', label: 'Exclude / Fade' },
}

const ROI_COLORS: Record<string, string> = {
  GREEN: 'text-emerald-600 dark:text-emerald-400',
  YELLOW: 'text-amber-600 dark:text-amber-400',
  RED: 'text-red-600 dark:text-red-400',
}

function fmt(v: number | null, suffix = '') {
  if (v === null || v === undefined) return '—'
  return (v > 0 ? '+' : '') + v.toFixed(1) + suffix
}

// --- Component ---

export default function LeagueMatrixTab() {
  const [data, setData] = useState<LeagueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterLight, setFilterLight] = useState<Light | 'ALL'>('ALL')
  const [sortMarket, setSortMarket] = useState<Market>('O2.5')
  const [sortAsc, setSortAsc] = useState(false)
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null)

  useEffect(() => {
    fetchMatrix()
  }, [])

  const fetchMatrix = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/soccer/league-matrix')
      if (!res.ok) throw new Error('Failed to load matrix data')
      const json = await res.json()
      setData(json.matrix)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Counts
  const counts = useMemo(() => {
    let g = 0, y = 0, r = 0
    for (const row of data) {
      for (const m of MARKETS) {
        const cell = row.markets[m]
        if (!cell) continue
        if (cell.light === 'GREEN') g++
        else if (cell.light === 'YELLOW') y++
        else r++
      }
    }
    return { green: g, yellow: y, red: r, total: g + y + r }
  }, [data])

  // Filtered + sorted data
  const filtered = useMemo(() => {
    let rows = [...data]

    // Filter: show league row if ANY cell matches the selected light (or ALL)
    if (filterLight !== 'ALL') {
      rows = rows.filter(row =>
        MARKETS.some(m => row.markets[m]?.light === filterLight)
      )
    }

    // Sort by selected market's ROI (desc) or Brier for markets without ROI
    rows.sort((a, b) => {
      const cellA = a.markets[sortMarket]
      const cellB = b.markets[sortMarket]
      const valA = cellA?.roi ?? cellA?.brier ?? 999
      const valB = cellB?.roi ?? cellB?.brier ?? 999
      return sortAsc ? valA - valB : valB - valA
    })

    return rows
  }, [data, filterLight, sortMarket, sortAsc])

  // --- Render ---

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="py-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchMatrix} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + summary cards */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrafficCone className="w-5 h-5 text-amber-500" />
            League × Market Traffic-Light Matrix
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            4-season backtest (2022–2026) &middot; 5-season exponential-decay training &middot; {data.length} leagues
          </p>
        </div>
        <Button onClick={fetchMatrix} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className={`${LIGHT_CONFIG.GREEN.bg} ${LIGHT_CONFIG.GREEN.border} border`}>
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${LIGHT_CONFIG.GREEN.dot}`} />
              <span className={`text-sm font-medium ${LIGHT_CONFIG.GREEN.text}`}>Green</span>
            </div>
            <span className={`text-lg font-bold ${LIGHT_CONFIG.GREEN.text}`}>{counts.green}</span>
          </CardContent>
        </Card>
        <Card className={`${LIGHT_CONFIG.YELLOW.bg} ${LIGHT_CONFIG.YELLOW.border} border`}>
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${LIGHT_CONFIG.YELLOW.dot}`} />
              <span className={`text-sm font-medium ${LIGHT_CONFIG.YELLOW.text}`}>Yellow</span>
            </div>
            <span className={`text-lg font-bold ${LIGHT_CONFIG.YELLOW.text}`}>{counts.yellow}</span>
          </CardContent>
        </Card>
        <Card className={`${LIGHT_CONFIG.RED.bg} ${LIGHT_CONFIG.RED.border} border`}>
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${LIGHT_CONFIG.RED.dot}`} />
              <span className={`text-sm font-medium ${LIGHT_CONFIG.RED.text}`}>Red</span>
            </div>
            <span className={`text-lg font-bold ${LIGHT_CONFIG.RED.text}`}>{counts.red}</span>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" /> GREEN: Positive ROI, 500+ matches, good Brier &rarr; <strong>Full stakes</strong></span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" /> YELLOW: Marginal ROI or modest sample &rarr; <strong>Half stakes / monitor</strong></span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" /> RED: Negative ROI with 500+ matches or bad Brier &rarr; <strong>Exclude or fade</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex gap-1">
          {(['ALL', 'GREEN', 'YELLOW', 'RED'] as const).map(l => (
            <Badge
              key={l}
              variant={filterLight === l ? 'default' : 'outline'}
              className={`cursor-pointer text-xs ${filterLight === l && l === 'GREEN' ? 'bg-emerald-600 hover:bg-emerald-700' : ''} ${filterLight === l && l === 'YELLOW' ? 'bg-amber-600 hover:bg-amber-700' : ''} ${filterLight === l && l === 'RED' ? 'bg-red-600 hover:bg-red-700' : ''}`}
              onClick={() => setFilterLight(l)}
            >
              {l === 'ALL' ? 'All' : l === 'GREEN' ? 'Green' : l === 'YELLOW' ? 'Yellow' : 'Red'}
            </Badge>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-2">
          Sort by:
        </span>
        <div className="flex gap-1">
          {MARKETS.map(m => (
            <Badge
              key={m}
              variant={sortMarket === m ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => {
                if (sortMarket === m) setSortAsc(!sortAsc)
                else { setSortMarket(m); setSortAsc(false) }
              }}
            >
              {m} {sortMarket === m ? (sortAsc ? '↑' : '↓') : ''}
            </Badge>
          ))}
        </div>
      </div>

      {/* Compact Matrix */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Compact Matrix</CardTitle>
          <CardDescription>Click a row to expand full details</CardDescription>
        </CardHeader>
        <CardContent className="px-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="min-w-[160px]">League</TableHead>
                  <TableHead className="text-center min-w-[120px]">O2.5</TableHead>
                  <TableHead className="text-center min-w-[120px]">BTTS</TableHead>
                  <TableHead className="text-center min-w-[120px]">O3.5</TableHead>
                  <TableHead className="text-center min-w-[120px]">1X2</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(row => {
                  const isExpanded = expandedLeague === row.league
                  return (
                    <>
                      <TableRow
                        key={row.league}
                        className={`cursor-pointer hover:bg-muted/50 ${isExpanded ? 'bg-muted/30' : ''}`}
                        onClick={() => setExpandedLeague(isExpanded ? null : row.league)}
                      >
                        <TableCell className="w-8 px-2">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{row.name}</div>
                          <div className="text-xs text-muted-foreground">{row.country} &middot; {row.totalMatches.toLocaleString()} matches</div>
                        </TableCell>
                        {MARKETS.map(m => {
                          const cell = row.markets[m]
                          if (!cell) return <TableCell key={m} className="text-center">—</TableCell>
                          const cfg = LIGHT_CONFIG[cell.light]
                          return (
                            <TableCell key={m} className="text-center">
                              <div className={`inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-md ${cfg.bg} ${cfg.border} border`}>
                                <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                                <span className={`text-xs font-semibold ${cfg.text}`}>
                                  {cell.roi !== null
                                    ? fmt(cell.roi, '%')
                                    : cell.brier !== null
                                      ? `B ${cell.brier.toFixed(3)}`
                                      : `Cal ${cell.calibration?.toFixed(2) ?? '—'}`}
                                </span>
                              </div>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      {/* Expanded detail row */}
                      {isExpanded && (
                        <TableRow key={`${row.league}-detail`}>
                          <TableCell colSpan={6} className="bg-muted/20 px-4 py-3">
                            <LeagueDetailRow row={row} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Per-market ranked tables */}
      {(['O2.5', 'BTTS'] as const).map(market => (
        <MarketTable key={market} data={data} market={market} />
      ))}

      {/* O3.5 table (no ROI) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            O3.5 Market &mdash; Calibration &amp; Accuracy
            <Badge variant="outline" className="text-xs font-normal">No ROI data</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>League</TableHead>
                  <TableHead className="text-right">Matches</TableHead>
                  <TableHead className="text-right">Calibration</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data]
                  .sort((a, b) => (a.markets['O3.5']?.accuracy ?? 0) - (b.markets['O3.5']?.accuracy ?? 0))
                  .reverse()
                  .map(row => {
                    const cell = row.markets['O3.5']
                    if (!cell) return null
                    const cfg = LIGHT_CONFIG[cell.light]
                    return (
                      <TableRow key={row.league}>
                        <TableCell><div className={`w-3 h-3 rounded-full ${cfg.dot}`} /></TableCell>
                        <TableCell className="font-medium text-sm">{row.name}</TableCell>
                        <TableCell className="text-right text-sm">{cell.totalMatches.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm">{cell.calibration?.toFixed(3) ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{cell.accuracy?.toFixed(1) + '%' ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{cell.reason}</TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 1X2 table (no ROI) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            1X2 Market &mdash; Brier Score &amp; Accuracy
            <Badge variant="outline" className="text-xs font-normal">No ROI data</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>League</TableHead>
                  <TableHead className="text-right">Matches</TableHead>
                  <TableHead className="text-right">Brier</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data]
                  .sort((a, b) => (a.markets['1X2']?.brier ?? 999) - (b.markets['1X2']?.brier ?? 999))
                  .map(row => {
                    const cell = row.markets['1X2']
                    if (!cell) return null
                    const cfg = LIGHT_CONFIG[cell.light]
                    return (
                      <TableRow key={row.league}>
                        <TableCell><div className={`w-3 h-3 rounded-full ${cfg.dot}`} /></TableCell>
                        <TableCell className="font-medium text-sm">{row.name}</TableCell>
                        <TableCell className="text-right text-sm">{cell.totalMatches.toLocaleString()}</TableCell>
                        <TableCell className={`text-right text-sm font-mono ${ROI_COLORS[cell.light]}`}>{cell.brier?.toFixed(3) ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{cell.accuracy?.toFixed(1) + '%' ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{cell.reason}</TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Actions */}
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recommended Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {(['GREEN', 'YELLOW', 'RED'] as const).map(light => {
              const cfg = LIGHT_CONFIG[light]
              const items = data.flatMap(row =>
                MARKETS
                  .filter(m => row.markets[m]?.light === light)
                  .map(m => {
                    const cell = row.markets[m]!
                    const detail = cell.roi !== null ? fmt(cell.roi, '%') : cell.brier !== null ? `Brier ${cell.brier.toFixed(3)}` : ''
                    return { name: row.name, market: m, detail }
                  })
              )
              return (
                <div key={light}>
                  <div className={`flex items-center gap-2 mb-2`}>
                    <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                    <span className={`text-sm font-semibold ${cfg.text}`}>{cfg.label} ({items.length})</span>
                  </div>
                  <ul className="space-y-1">
                    {items.map((item, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{item.name}</span>{' '}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.market}</Badge>{' '}
                        <span className={ROI_COLORS[light]}>{item.detail}</span>
                      </li>
                    ))}
                    {items.length === 0 && <li className="text-xs text-muted-foreground italic">None</li>}
                  </ul>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Sub-components ---

function MarketTable({ data, market }: { data: LeagueRow[]; market: 'O2.5' | 'BTTS' }) {
  const sorted = useMemo(
    () =>
      [...data]
        .filter(row => row.markets[market]?.roi !== null)
        .sort((a, b) => (b.markets[market]?.roi ?? -999) - (a.markets[market]?.roi ?? -999)),
    [data, market]
  )

  const cellCounts = useMemo(() => {
    let g = 0, y = 0, r = 0
    for (const row of sorted) {
      const cell = row.markets[market]
      if (!cell) continue
      if (cell.light === 'GREEN') g++
      else if (cell.light === 'YELLOW') y++
      else r++
    }
    return { green: g, yellow: y, red: r }
  }, [sorted, market])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {market} Market &mdash; Ranked by ROI
          <Badge variant="secondary" className="text-xs font-normal">
            {cellCounts.green} green &middot; {cellCounts.yellow} yellow &middot; {cellCounts.red} red
          </Badge>
        </CardTitle>
        <CardDescription>Flat stake at 60% confidence threshold (O2.5 @1.85, BTTS @1.80)</CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>League</TableHead>
                <TableHead className="text-right">Matches</TableHead>
                <TableHead className="text-right">Bets (60%)</TableHead>
                <TableHead className="text-right">Hit Rate</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right">Brier</TableHead>
                <TableHead className="text-right">Calibration</TableHead>
                <TableHead className="text-right">Accuracy</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(row => {
                const cell = row.markets[market]
                if (!cell) return null
                const cfg = LIGHT_CONFIG[cell.light]
                return (
                  <TableRow key={row.league}>
                    <TableCell>
                      <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                    </TableCell>
                    <TableCell className="font-medium text-sm">{row.name}</TableCell>
                    <TableCell className="text-right text-sm">{cell.totalMatches.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">{cell.totalBets60.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">{cell.hitRate?.toFixed(1) + '%' ?? '—'}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${ROI_COLORS[cell.light]}`}>
                      {fmt(cell.roi, '%')}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">{cell.brier?.toFixed(3) ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{cell.calibration?.toFixed(3) ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm">{cell.accuracy?.toFixed(1) + '%' ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{cell.reason}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function LeagueDetailRow({ row }: { row: LeagueRow }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {MARKETS.map(m => {
        const cell = row.markets[m]
        if (!cell) return <div key={m} className="text-sm text-muted-foreground">{m}: No data</div>
        const cfg = LIGHT_CONFIG[cell.light]
        return (
          <div key={m} className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-semibold ${cfg.text}`}>{m}</span>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={`text-xs ${cfg.text}`}>{cfg.label}</span>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              {cell.roi !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ROI</span>
                  <span className={`font-semibold ${ROI_COLORS[cell.light]}`}>{fmt(cell.roi, '%')}</span>
                </div>
              )}
              {cell.brier !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Brier</span>
                  <span>{cell.brier.toFixed(3)}</span>
                </div>
              )}
              {cell.calibration !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Calibration</span>
                  <span>{cell.calibration.toFixed(3)}</span>
                </div>
              )}
              {cell.accuracy !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accuracy</span>
                  <span>{cell.accuracy.toFixed(1)}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bets (60%)</span>
                <span>{cell.totalBets60.toLocaleString()}</span>
              </div>
              {cell.hitRate !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hit Rate</span>
                  <span>{cell.hitRate.toFixed(1)}%</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 italic">{cell.reason}</p>
          </div>
        )
      })}
    </div>
  )
}
