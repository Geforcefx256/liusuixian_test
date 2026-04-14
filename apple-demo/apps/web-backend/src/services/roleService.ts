import type { ListRolesQuery, UpdateRoleInput } from '../types/user.js'
import * as userRepository from '../repositories/userRepository.js'

export async function listRoles(query: ListRolesQuery) {
  return userRepository.listRoles(query)
}

export async function updateRole(roleId: number, input: UpdateRoleInput) {
  return userRepository.updateRole(roleId, input)
}
