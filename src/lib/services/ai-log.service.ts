import type { SupabaseClient } from '@supabase/supabase-js';
import type { AILogDTO, AILogsListDTO } from '../../types';
import type { Tables } from '../../db/database.types';

type DbAILog = Tables<'ai_generation_logs'>;

/**
 * Data required to create an AI generation log
 */
export interface CreateAILogData {
	userId: string;
	deckId: string | null;
	inputTextLength: number;
	generatedCardsCount: number;
	errorMessage: string | null;
}

/**
 * Filters for listing AI logs
 */
export interface ListLogsFilters {
	deckId?: string;
	from?: string;
	to?: string;
	limit: number;
	offset: number;
	sort: string;
	order: 'asc' | 'desc';
}

/**
 * AILogService - Service for managing AI generation logs
 * 
 * Responsibilities:
 * - Create log entries for AI generation attempts
 * - List logs with filtering and pagination
 * - Track success/failure of AI operations
 */
export const AILogService = {
	/**
	 * Create a new AI generation log entry
	 * 
	 * @param supabase - Supabase client
	 * @param data - Log data
	 * @returns Created log DTO
	 * @throws Error if log creation fails
	 */
	async createLog(supabase: SupabaseClient, data: CreateAILogData): Promise<AILogDTO> {
		const { data: log, error } = await supabase
			.from('ai_generation_logs')
			.insert({
				user_id: data.userId,
				deck_id: data.deckId,
				input_text_length: data.inputTextLength,
				generated_cards_count: data.generatedCardsCount,
				error_message: data.errorMessage,
			})
			.select()
			.single();

		if (error || !log) {
			console.error('[AILogService.createLog] Failed to create AI log:', error);
			throw new Error(`Failed to create AI log: ${error?.message || 'Unknown error'}`);
		}

		return this.mapDbLogToDTO(log);
	},

	/**
	 * List AI generation logs for a user with filtering and pagination
	 * 
	 * @param supabase - Supabase client
	 * @param userId - User ID to filter by
	 * @param filters - Optional filters (deckId, date range, pagination)
	 * @returns Paginated list of logs
	 * @throws Error if query fails
	 */
	async listLogs(
		supabase: SupabaseClient,
		userId: string,
		filters: ListLogsFilters
	): Promise<AILogsListDTO> {
		let query = supabase
			.from('ai_generation_logs')
			.select('*', { count: 'exact' })
			.eq('user_id', userId);

		// Apply filters
		if (filters.deckId) {
			query = query.eq('deck_id', filters.deckId);
		}
		if (filters.from) {
			query = query.gte('created_at', filters.from);
		}
		if (filters.to) {
			query = query.lte('created_at', filters.to);
		}

		// Apply sorting and pagination
		query = query
			.order(filters.sort === 'createdAt' ? 'created_at' : filters.sort, {
				ascending: filters.order === 'asc',
			})
			.range(filters.offset, filters.offset + filters.limit - 1);

		const { data, error, count } = await query;

		if (error) {
			console.error('[AILogService.listLogs] Failed to fetch AI logs:', error);
			throw new Error(`Failed to fetch AI logs: ${error.message}`);
		}

		return {
			items: (data || []).map((log) => this.mapDbLogToDTO(log)),
			total: count || 0,
			limit: filters.limit,
			offset: filters.offset,
		};
	},

	/**
	 * Map database AI log to DTO
	 * 
	 * @param log - Database log row
	 * @returns AILogDTO
	 */
	mapDbLogToDTO(log: DbAILog): AILogDTO {
		return {
			id: log.id,
			deckId: log.deck_id,
			inputTextLength: log.input_text_length,
			generatedCardsCount: log.generated_cards_count,
			errorMessage: log.error_message,
			createdAt: log.created_at,
		};
	},
};
