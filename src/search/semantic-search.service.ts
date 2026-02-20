import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface SearchOptions {
  filters?: Record<string, unknown>;
  indexName?: string;
  useHybrid?: boolean;
  minScore?: number;
  vectorThreshold?: number;
  enableQueryAnalysis?: boolean;
  enableQueryExpansion?: boolean;
  enableReranking?: boolean;
  sortBy?: 'relevancy' | 'recency' | 'balanced';
}

export interface RawSemanticResult {
  entity_id: string;
  title?: string;
  content?: string;
  matched_chunk?: string;
  score: number;
  rerank_score?: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);
  private readonly ingestionSvcUrl: string;
  private readonly apiKey: string;
  private readonly masterIndex: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.ingestionSvcUrl =
      this.configService.get<string>('INGESTION_SVC_URL') || '';
    this.apiKey = this.configService.get<string>('SERVICE_API_KEY', '');
    this.masterIndex =
      this.configService.get<string>('SEARCH_MASTER_INDEX') || '';
  }

  async ingestVideo(
    videoId: string,
    payload: {
      title: string;
      content: string;
      description?: string;
      category?: string;
    },
    metadata: Record<string, unknown> = {},
  ) {
    try {
      const traceId = `openstream-video-${videoId}-${Date.now()}`;

      const requestPayload = {
        trace_id: traceId,
        source_app: 'openstream',
        entity_id: videoId,
        entity_type: 'video_transcript',
        index_name: this.masterIndex,
        operation: 'index',
        timestamp: new Date().toISOString(),
        chunking_strategy: 'semantic',
        chunk_size: 300,
        chunk_overlap: 50,
        payload: {
          ...payload,
          metadata: {
            ...metadata,
            videoId,
            entity_type: 'video_transcript',
          },
        },
        enrichments: ['summary', 'vectors', 'entities'],
      };

      this.logger.log(`Ingesting video ${videoId} for semantic search`);

      const response = await firstValueFrom(
        this.httpService.post<{ data: unknown }>(
          `${this.ingestionSvcUrl}/ingest`,
          requestPayload,
          {
            headers: {
              'X-API-KEY': this.apiKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to ingest video ${videoId}: ${errMsg}`,
        errStack,
      );
      return null;
    }
  }

  async searchVideos(
    query: string,
    limit: number = 20,
    options: SearchOptions = {},
  ) {
    try {
      const response = await firstValueFrom(
        this.httpService.post<{ results: RawSemanticResult[] }>(
          `${this.ingestionSvcUrl}/search`,
          {
            query,
            limit,
            filters: {
              ...options.filters,
              source_app: 'openstream',
              entity_type: 'video_transcript',
            },
            index_name: options.indexName || this.masterIndex,
            use_hybrid:
              options.useHybrid !== undefined ? options.useHybrid : true,
            min_score: options.minScore || 25.0,
            vector_threshold: options.vectorThreshold || 0.65,
            enable_query_analysis: options.enableQueryAnalysis ?? true,
            enable_query_expansion: options.enableQueryExpansion ?? false,
            enable_reranking: options.enableReranking ?? true,
            sort_by: options.sortBy || 'relevancy',
          },
          {
            headers: {
              'X-API-KEY': this.apiKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data?.results || [];
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Semantic search failed: ${errMsg}`, errStack);
      return [];
    }
  }
}
