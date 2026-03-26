import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize?: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalItems, pageSize = 10, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  if (totalItems <= pageSize) return null

  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  // Calcul des pages visibles (max 5)
  let startPage = Math.max(1, currentPage - 2)
  let endPage = Math.min(totalPages, startPage + 4)
  if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4)
  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)

  return (
    <div className="pagination">
      <span className="pagination-info">
        {start}–{end} sur {totalItems}
      </span>
      <div className="pagination-btns">
        <button
          className="page-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft size={13} />
        </button>

        {startPage > 1 && (
          <>
            <button className="page-btn" onClick={() => onPageChange(1)}>1</button>
            {startPage > 2 && <span style={{ color: 'var(--text-muted)', fontSize: 12, padding: '0 2px' }}>…</span>}
          </>
        )}

        {pages.map(n => (
          <button
            key={n}
            className={`page-btn ${currentPage === n ? 'active' : ''}`}
            onClick={() => onPageChange(n)}
          >
            {n}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span style={{ color: 'var(--text-muted)', fontSize: 12, padding: '0 2px' }}>…</span>}
            <button className="page-btn" onClick={() => onPageChange(totalPages)}>{totalPages}</button>
          </>
        )}

        <button
          className="page-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
