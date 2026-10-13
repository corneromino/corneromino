import { describe, expect, it } from 'vitest'
import { SandboxCellSystem, updatePowerStateFromNeighbors } from './cellSystem'

describe('SandboxCellSystem', () => {
  it('rotates only the corner selected by the user', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 1 },
      { cellKey: '1,0', corner: 1 },
    ])

    system.rotateCornerFromUser('0,0')
    system.processUpdates(1)

    expect(system.getState('0,0')?.corner).toBe(2)
    expect(system.getState('1,0')?.corner).toBe(1)
    expect(system.getState('0,1')).toBeUndefined()
  })

  it('does not notify neighbors when no update handler requests it', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 1 },
      { cellKey: '1,0', corner: 1 },
    ])

    system.rotateCornerFromUser('0,0')
    expect(system.getState('0,0')?.corner).toBe(2)
    expect(system.getState('1,0')?.corner).toBe(1)
    expect(system.hasPendingUpdates()).toBe(false)
  })

  it('allows update handlers to change a corneromino on/off state', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 1 },
      { cellKey: '1,0', corner: 1 },
    ], [
      (target, cellKey, state, previousState) => {
        const nextState = { ...state, isOn: true, sourceKey: '0,-1' }
        target.setCornerStateFromUpdate(cellKey, nextState)
        return previousState?.isOn !== nextState.isOn || previousState?.sourceKey !== nextState.sourceKey
      },
    ])

    system.rotateCornerFromUser('0,0')
    system.processUpdates(1)

    expect(system.getState('0,0')?.isOn).toBe(true)
    expect(system.getState('1,0')?.isOn).toBe(true)
  })

  it('turns A on when it touches a B that is off', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 0 },
      { cellKey: '1,0', corner: 2 },
    ], [updatePowerStateFromNeighbors])

    system.rotateCornerFromUser('0,0')
    system.processUpdates(1)

    expect(system.getState('0,0')?.corner).toBe(1)
    expect(system.getState('0,0')?.isOn).toBe(true)
    expect(system.getMarkers().find((marker) => marker.cellKey === '0,0')?.sourceKey).toBe('1,0')
    expect(system.getState('1,0')?.isOn).toBe(false)
    expect(system.getMarkers().find((marker) => marker.cellKey === '1,0')?.sourceKey).toBeNull()
  })

  it('turns a corner on when it touches the same type that is on', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 0 },
      { cellKey: '1,0', corner: 1 },
    ], [updatePowerStateFromNeighbors])
    system.setCornerStateFromUpdate('1,0', { corner: 1, isOn: true, sourceKey: '1,-1' })

    system.rotateCornerFromUser('0,0')

    expect(system.getState('0,0')?.corner).toBe(1)
    expect(system.getState('0,0')?.isOn).toBe(true)
    expect(system.getMarkers().find((marker) => marker.cellKey === '0,0')?.sourceKey).toBe('1,0')
  })

  it('does not update a neighbor when removing a corner', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 1 },
      { cellKey: '1,0', corner: 1 },
    ])

    system.removeCornerFromUser('0,0')
    system.processUpdates(1)

    expect(system.getState('0,0')).toBeUndefined()
    expect(system.getState('1,0')?.corner).toBe(1)
  })

})
