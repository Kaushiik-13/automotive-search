import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { PoolClient } from 'pg';
import type { AuthenticatedSession } from '../auth/auth.types';
import { ApplicationAuditService } from '../common/application-audit.service';
import { DatabaseService } from '../database/database.service';

export interface CubeQueryResult {
  query: {
    version: number;
    model: string;
    measures: string[];
    dimensions: string[];
    filters: Array<{ field: string; operator: string; value: unknown }>;
    limit: number;
  };
  rows: Array<Record<string, unknown>>;
}

interface CubeQueryModule {
  executeAuthorizedCubeQuery(
    input: unknown,
    runInAuthorizationContext: (
      operation: (client: PoolClient) => Promise<unknown>,
    ) => Promise<unknown>,
  ): Promise<CubeQueryResult>;
}

@Injectable()
export class ConversationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: ApplicationAuditService,
  ) {}

  async query(
    session: AuthenticatedSession,
    input: unknown,
    requestId: string,
  ): Promise<CubeQueryResult> {
    try {
      const cubeQuery = await this.loadCubeQueryModule();
      const result = await cubeQuery.executeAuthorizedCubeQuery(
        input,
        (operation) =>
          this.database.withAuthorizationContext(session, operation),
      );

      await this.audit.record(
        requestId,
        session,
        'conversation.query',
        'allow',
        'automotive.query',
        null,
        {
          model: result.query.model,
          measures: result.query.measures,
          dimensions: result.query.dimensions,
          filterFields: result.query.filters.map((filter) => filter.field),
          rowCount: result.rows.length,
        },
      );
      return result;
    } catch (error) {
      const queryError = (error && typeof error === 'object' ? error : {}) as {
        name?: string;
        code?: string;
        errors?: unknown;
      };
      if (queryError.name === 'CubeQueryValidationError') {
        throw new BadRequestException({
          code: 'INVALID_CUBE_QUERY',
          message: 'The requested query is not supported.',
          errors: queryError.errors,
        });
      }
      if (queryError.name === 'CubeQueryAuthorizationError') {
        throw new ForbiddenException({
          code: 'ACCESS_DENIED',
          message: 'The active organization or role cannot read this data.',
        });
      }
      if (
        queryError.code === 'ERR_MODULE_NOT_FOUND' ||
        queryError.code === 'QUERY_ENGINE_UNAVAILABLE'
      ) {
        throw new InternalServerErrorException({
          code: 'QUERY_ENGINE_UNAVAILABLE',
          message: 'The conversational query engine is not available.',
        });
      }
      throw error;
    }
  }

  private async loadCubeQueryModule(): Promise<CubeQueryModule> {
    const candidates = [
      process.env.CUBE_QUERY_PACKAGE_ENTRY,
      resolve(process.cwd(), '../packages/cube-query/src/qgen.mjs'),
      resolve(process.cwd(), '../../../packages/cube-query/src/qgen.mjs'),
    ].filter((candidate): candidate is string => Boolean(candidate));
    const entry = candidates.find((candidate) => existsSync(candidate));
    if (!entry) {
      const error = new Error('Cube Query package entry was not found.');
      Object.assign(error, { code: 'QUERY_ENGINE_UNAVAILABLE' });
      throw error;
    }
    return (await import(pathToFileURL(entry).href)) as CubeQueryModule;
  }
}
