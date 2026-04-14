import type {
  AuthenticatedUser,
  ListUsersQuery,
  ReplaceUserRolesInput,
  UpdateUserInput,
  UpdateUserStatusInput
} from '../types/user.js'
import * as userRepository from '../repositories/userRepository.js'
import { ForbiddenError, NotFoundError } from '../utils/errors.js'

function ensureCanManageSuperAdmin(actor: AuthenticatedUser, nextRoleKeys: string[], currentRoleKeys: string[]): void {
  const actorRoleKeys = actor.user.roles.map(role => role.roleKey)
  const actorIsSuperAdmin = actorRoleKeys.includes('super_admin')
  const nextIncludesSuperAdmin = nextRoleKeys.includes('super_admin')
  const currentIncludesSuperAdmin = currentRoleKeys.includes('super_admin')

  if (!actorIsSuperAdmin && (nextIncludesSuperAdmin || currentIncludesSuperAdmin)) {
    throw new ForbiddenError('Only super_admin can assign or remove super_admin')
  }
}

export async function listUsers(query: ListUsersQuery) {
  return userRepository.listUsers(query)
}

export async function getUser(userId: number) {
  const user = await userRepository.getUserDetailById(userId)
  if (!user) {
    throw new NotFoundError(`User ${userId} not found`)
  }
  return user
}

export async function updateUser(userId: number, input: UpdateUserInput) {
  await userRepository.updateUser(userId, input)
  return getUser(userId)
}

export async function updateUserStatus(userId: number, input: UpdateUserStatusInput) {
  await getUser(userId)
  await userRepository.updateUserStatus(userId, input.status)
  return getUser(userId)
}

export async function replaceUserRoles(actor: AuthenticatedUser, userId: number, input: ReplaceUserRolesInput) {
  const user = await getUser(userId)
  const currentRoleKeys = user.roles.map(role => role.roleKey)
  const nextRoles = await Promise.all(input.roleIds.map(roleId => userRepository.getRoleById(roleId)))
  const missingRoleIndex = nextRoles.findIndex(role => role === null)
  if (missingRoleIndex >= 0) {
    throw new NotFoundError(`Role ${input.roleIds[missingRoleIndex]} not found`)
  }

  ensureCanManageSuperAdmin(
    actor,
    nextRoles.map(role => role!.roleKey),
    currentRoleKeys
  )

  await userRepository.replaceUserRoles(userId, input.roleIds)
  return getUser(userId)
}
