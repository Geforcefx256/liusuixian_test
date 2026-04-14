import express, { type RequestHandler } from 'express'

export interface RequestBodyLimits {
  defaultJson: string
  fileSaveJson: string
}

export function createDefaultJsonParser(limits: RequestBodyLimits): RequestHandler {
  return express.json({ limit: limits.defaultJson })
}

export function createFileSaveJsonParser(limits: RequestBodyLimits): RequestHandler {
  return express.json({ limit: limits.fileSaveJson })
}
