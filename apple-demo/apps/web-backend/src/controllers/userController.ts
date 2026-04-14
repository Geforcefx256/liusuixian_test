import type { Response } from 'express'

import type { AuthenticatedRequest } from '../auth/middleware.js'
import { asyncHandler } from '../middlewares/error.js'
import * as userService from '../services/userService.js'
import {
  ListUsersQuerySchema,
  ReplaceUserRolesSchema,
  UpdateUserSchema,
  UpdateUserStatusSchema
} from '../types/user.js'
import { paginated, success } from '../utils/response.js'

export const listUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const query = ListUsersQuerySchema.parse(req.query)
  const result = await userService.listUsers(query)
  res.status(200).json(paginated(result.items, result.total, query.page, query.pageSize))
})

export const getUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await userService.getUser(Number(req.params.userId))
  res.status(200).json(success(user))
})

export const updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const input = UpdateUserSchema.parse(req.body)
  const user = await userService.updateUser(Number(req.params.userId), input)
  res.status(200).json(success(user))
})

export const updateUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const input = UpdateUserStatusSchema.parse(req.body)
  const user = await userService.updateUserStatus(Number(req.params.userId), input)
  res.status(200).json(success(user))
})

export const replaceUserRoles = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const input = ReplaceUserRolesSchema.parse(req.body)
  const user = await userService.replaceUserRoles(req.auth!, Number(req.params.userId), input)
  res.status(200).json(success(user))
})
