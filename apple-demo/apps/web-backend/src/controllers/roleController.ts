import type { Request, Response } from 'express'

import { asyncHandler } from '../middlewares/error.js'
import * as roleService from '../services/roleService.js'
import { ListRolesQuerySchema, UpdateRoleSchema } from '../types/user.js'
import { success } from '../utils/response.js'

export const listRoles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = ListRolesQuerySchema.parse(req.query)
  const roles = await roleService.listRoles(query)
  res.status(200).json(success(roles))
})

export const updateRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = UpdateRoleSchema.parse(req.body)
  const role = await roleService.updateRole(Number(req.params.roleId), input)
  res.status(200).json(success(role))
})
