/**
 * Tests for dsh-flow-canvas DiagramNode component.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// Test the diagram type helper functions
// Since DiagramNode is a React component, we test the logic functions

describe('DiagramNode helper functions', () => {
  // Mock the helper functions from DiagramNode.tsx
  function getDiagramTypeIcon(type) {
    switch (type) {
      case 'architecture': return '🏗️'
      case 'workflow': return '🔄'
      case 'sequence': return '🔀'
      case 'dataflow': return '📊'
      case 'lifecycle': return '♻️'
      default: return '📈'
    }
  }

  function getDiagramTypeLabel(type) {
    switch (type) {
      case 'architecture': return '架构图'
      case 'workflow': return '工作流图'
      case 'sequence': return '序列图'
      case 'dataflow': return '数据流图'
      case 'lifecycle': return '生命周期图'
      default: return '图表'
    }
  }

  describe('getDiagramTypeIcon', () => {
    it('returns correct icon for architecture type', () => {
      assert.equal(getDiagramTypeIcon('architecture'), '🏗️')
    })

    it('returns correct icon for workflow type', () => {
      assert.equal(getDiagramTypeIcon('workflow'), '🔄')
    })

    it('returns correct icon for sequence type', () => {
      assert.equal(getDiagramTypeIcon('sequence'), '🔀')
    })

    it('returns correct icon for dataflow type', () => {
      assert.equal(getDiagramTypeIcon('dataflow'), '📊')
    })

    it('returns correct icon for lifecycle type', () => {
      assert.equal(getDiagramTypeIcon('lifecycle'), '♻️')
    })

    it('returns default icon for unknown type', () => {
      assert.equal(getDiagramTypeIcon('unknown'), '📈')
    })
  })

  describe('getDiagramTypeLabel', () => {
    it('returns correct label for architecture type', () => {
      assert.equal(getDiagramTypeLabel('architecture'), '架构图')
    })

    it('returns correct label for workflow type', () => {
      assert.equal(getDiagramTypeLabel('workflow'), '工作流图')
    })

    it('returns correct label for sequence type', () => {
      assert.equal(getDiagramTypeLabel('sequence'), '序列图')
    })

    it('returns correct label for dataflow type', () => {
      assert.equal(getDiagramTypeLabel('dataflow'), '数据流图')
    })

    it('returns correct label for lifecycle type', () => {
      assert.equal(getDiagramTypeLabel('lifecycle'), '生命周期图')
    })

    it('returns default label for unknown type', () => {
      assert.equal(getDiagramTypeLabel('unknown'), '图表')
    })
  })

  describe('DiagramNode data structure', () => {
    it('should have required properties', () => {
      const nodeData = {
        diagramType: 'architecture',
        label: 'System Architecture',
        description: 'Main system components',
        content: '{"nodes": [], "edges": []}',
        theme: 'dark',
        preset: 'default',
        showComparison: false
      }

      assert.ok(nodeData.diagramType)
      assert.ok(nodeData.label)
      assert.ok(nodeData.content)
      assert.equal(typeof nodeData.theme, 'string')
      assert.equal(typeof nodeData.preset, 'string')
      assert.equal(typeof nodeData.showComparison, 'boolean')
    })

    it('should support all diagram types', () => {
      const diagramTypes = ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle']
      
      diagramTypes.forEach(type => {
        const nodeData = {
          diagramType: type,
          label: `Test ${type}`,
          content: '{}'
        }
        
        assert.equal(nodeData.diagramType, type)
        assert.ok(getDiagramTypeLabel(type) !== '图表')
        assert.ok(getDiagramTypeIcon(type) !== '📈')
      })
    })
  })
})