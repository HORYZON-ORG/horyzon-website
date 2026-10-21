-- Catalog-only, adaptive readiness approved in P2C-B. No business reads/writes.
-- Canonical rollout: P1 -> P2B -> capabilities. Missing objects mean unavailable.
begin;
create function public.patrimonial_capability_objects(p_spec jsonb) returns boolean
language plpgsql stable security invoker set search_path = pg_catalog, public as $$
declare t jsonb; c jsonb; f jsonb; obj oid; ok boolean; privilege text;
begin
  for t in select value from jsonb_array_elements(p_spec->'tables') loop
    obj:=to_regclass('public.'||(t->>'name'));
    if obj is null then return false; end if;
    select relkind='r' and relrowsecurity and relforcerowsecurity into ok from pg_class where oid=obj;
    if not coalesce(ok,false) or not has_table_privilege(current_user,obj,'SELECT') or not has_table_privilege('service_role',obj,'SELECT')
      or has_table_privilege('anon',obj,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_table_privilege('authenticated',obj,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_any_column_privilege('anon',obj,'SELECT,INSERT,UPDATE,REFERENCES')
      or has_any_column_privilege('authenticated',obj,'SELECT,INSERT,UPDATE,REFERENCES') then return false; end if;
    for privilege in select jsonb_array_elements_text(t->'privileges') loop
      if not has_table_privilege(current_user,obj,privilege) or not has_table_privilege('service_role',obj,privilege) then return false; end if;
    end loop;
    for c in select value from jsonb_array_elements(t->'columns') loop
      select format_type(a.atttypid,a.atttypmod)=c->>'type' and a.attnotnull=(c->>'notnull')::boolean
        and pg_get_expr(d.adbin,d.adrelid) is not distinct from c->>'default' into ok
        from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=obj and a.attname=c->>'name' and a.attnum>0 and not a.attisdropped;
      if not coalesce(ok,false) then return false; end if;
    end loop;
  end loop;
  for f in select value from jsonb_array_elements(p_spec->'functions') loop
    obj:=to_regprocedure('public.'||(f->>'signature'));
    if obj is null then return false; end if;
    select not p.prosecdef and p.prokind='f' and p.provolatile=(f->>'volatility')::"char" and pg_get_function_result(p.oid)=f->>'result'
      and p.proconfig @> array['search_path=pg_catalog, public']
      and f->'hashes' ? md5(replace(p.prosrc,E'\r\n',E'\n')) into ok from pg_proc p where p.oid=obj;
    if not coalesce(ok,false) or not has_function_privilege(current_user,obj,'EXECUTE') or not has_function_privilege('service_role',obj,'EXECUTE')
      or has_function_privilege('anon',obj,'EXECUTE') or has_function_privilege('authenticated',obj,'EXECUTE') then return false; end if;
  end loop;
  for c in select value from jsonb_array_elements(p_spec->'constraints') loop
    select convalidated and pg_get_constraintdef(oid)=c->>'definition' into ok from pg_constraint
      where conrelid=to_regclass('public.'||(c->>'relation')) and conname=c->>'name';
    if not coalesce(ok,false) then return false; end if;
  end loop;
  for c in select value from jsonb_array_elements(p_spec->'indexes') loop
    obj:=to_regclass('public.'||(c->>'name'));
    select indisvalid and indisready and pg_get_indexdef(indexrelid)=c->>'definition' into ok from pg_index where indexrelid=obj;
    if not coalesce(ok,false) then return false; end if;
  end loop;
  for c in select value from jsonb_array_elements(p_spec->'triggers') loop
    select tgenabled='O' and pg_get_triggerdef(oid)=c->>'definition' into ok from pg_trigger
      where tgrelid=to_regclass('public.'||(c->>'relation')) and tgname=c->>'name';
    if not coalesce(ok,false) then return false; end if;
  end loop;
  return true;
end $$;

create function public.patrimonial_store_capabilities() returns jsonb
language plpgsql stable security invoker set search_path = pg_catalog, public as $$
declare base_ok boolean; assignment_ok boolean; owner_ok boolean;
begin
  base_ok:=not exists(select 1 from pg_proc p where p.oid in ('public.patrimonial_store_capabilities()'::regprocedure,'public.patrimonial_capability_objects(jsonb)'::regprocedure)
    and (p.prosecdef or p.provolatile<>'s' or not coalesce(p.proconfig @> array['search_path=pg_catalog, public'],false)
      or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')))
    and public.patrimonial_capability_objects('{
  "tables": [],
  "functions": [
    {
      "signature": "patrimonial_store_health()",
      "result": "jsonb",
      "hashes": [
        "1eab07a9f9f7758647f0fbd38a5a17fc"
      ],
      "volatility": "v"
    }
  ],
  "constraints": [],
  "indexes": [],
  "triggers": []
}'::jsonb);
  assignment_ok:=base_ok and public.patrimonial_capability_objects('{
  "tables": [
    {
      "name": "patrimonial_operators",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "default": "gen_random_uuid()",
          "notnull": true
        },
        {
          "name": "operator_key",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "display_name",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "remote_user_ref",
          "type": "text",
          "default": null,
          "notnull": false
        },
        {
          "name": "active",
          "type": "boolean",
          "default": "true",
          "notnull": true
        },
        {
          "name": "role",
          "type": "text",
          "default": null,
          "notnull": false
        },
        {
          "name": "capacity",
          "type": "integer",
          "default": null,
          "notnull": false
        },
        {
          "name": "sort_order",
          "type": "integer",
          "default": "0",
          "notnull": true
        },
        {
          "name": "metadata",
          "type": "jsonb",
          "default": "''{}''::jsonb",
          "notnull": true
        },
        {
          "name": "revision",
          "type": "integer",
          "default": "0",
          "notnull": true
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "default": "now()",
          "notnull": true
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "default": "now()",
          "notnull": true
        }
      ],
      "privileges": [
        "SELECT",
        "INSERT",
        "UPDATE"
      ]
    },
    {
      "name": "patrimonial_operator_pools",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "default": "gen_random_uuid()",
          "notnull": true
        },
        {
          "name": "pool_key",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "name",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "active",
          "type": "boolean",
          "default": "true",
          "notnull": true
        },
        {
          "name": "assignment_policy",
          "type": "text",
          "default": "''ROUND_ROBIN''::text",
          "notnull": true
        },
        {
          "name": "metadata",
          "type": "jsonb",
          "default": "''{}''::jsonb",
          "notnull": true
        },
        {
          "name": "revision",
          "type": "integer",
          "default": "0",
          "notnull": true
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "default": "now()",
          "notnull": true
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "default": "now()",
          "notnull": true
        }
      ],
      "privileges": [
        "SELECT",
        "INSERT",
        "UPDATE"
      ]
    },
    {
      "name": "patrimonial_operator_pool_members",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "default": "gen_random_uuid()",
          "notnull": true
        },
        {
          "name": "pool_id",
          "type": "uuid",
          "default": null,
          "notnull": true
        },
        {
          "name": "operator_id",
          "type": "uuid",
          "default": null,
          "notnull": true
        },
        {
          "name": "active",
          "type": "boolean",
          "default": "true",
          "notnull": true
        },
        {
          "name": "weight",
          "type": "numeric",
          "default": null,
          "notnull": false
        },
        {
          "name": "joined_at",
          "type": "timestamp with time zone",
          "default": "now()",
          "notnull": true
        },
        {
          "name": "left_at",
          "type": "timestamp with time zone",
          "default": null,
          "notnull": false
        }
      ],
      "privileges": [
        "SELECT",
        "INSERT",
        "UPDATE"
      ]
    },
    {
      "name": "patrimonial_assignment_experiments",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "default": "gen_random_uuid()",
          "notnull": true
        },
        {
          "name": "experiment_key",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "name",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "status",
          "type": "text",
          "default": "''DRAFT''::text",
          "notnull": true
        },
        {
          "name": "pool_id",
          "type": "uuid",
          "default": null,
          "notnull": false
        },
        {
          "name": "assignment_method",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "target_per_operator",
          "type": "integer",
          "default": null,
          "notnull": false
        },
        {
          "name": "configuration",
          "type": "jsonb",
          "default": "''{}''::jsonb",
          "notnull": true
        },
        {
          "name": "revision",
          "type": "integer",
          "default": "0",
          "notnull": true
        },
        {
          "name": "started_at",
          "type": "timestamp with time zone",
          "default": null,
          "notnull": false
        },
        {
          "name": "ended_at",
          "type": "timestamp with time zone",
          "default": null,
          "notnull": false
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "default": "now()",
          "notnull": true
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "default": "now()",
          "notnull": true
        }
      ],
      "privileges": [
        "SELECT",
        "INSERT",
        "UPDATE"
      ]
    },
    {
      "name": "patrimonial_assignment_experiment_operators",
      "columns": [
        {
          "name": "experiment_id",
          "type": "uuid",
          "default": null,
          "notnull": true
        },
        {
          "name": "operator_id",
          "type": "uuid",
          "default": null,
          "notnull": true
        },
        {
          "name": "included",
          "type": "boolean",
          "default": "true",
          "notnull": true
        }
      ],
      "privileges": [
        "SELECT",
        "INSERT",
        "UPDATE"
      ]
    },
    {
      "name": "patrimonial_lead_snapshots",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "default": "gen_random_uuid()",
          "notnull": true
        },
        {
          "name": "snapshot_key",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "intent_id",
          "type": "uuid",
          "default": null,
          "notnull": true
        },
        {
          "name": "request_id",
          "type": "uuid",
          "default": null,
          "notnull": false
        },
        {
          "name": "funnel",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "source",
          "type": "text",
          "default": null,
          "notnull": false
        },
        {
          "name": "medium",
          "type": "text",
          "default": null,
          "notnull": false
        },
        {
          "name": "campaign",
          "type": "text",
          "default": null,
          "notnull": false
        },
        {
          "name": "profile",
          "type": "text",
          "default": null,
          "notnull": false
        },
        {
          "name": "maturity_level",
          "type": "text",
          "default": null,
          "notnull": false
        },
        {
          "name": "consultation_requested",
          "type": "boolean",
          "default": null,
          "notnull": false
        },
        {
          "name": "attributes",
          "type": "jsonb",
          "default": "''{}''::jsonb",
          "notnull": true
        },
        {
          "name": "schema_version",
          "type": "integer",
          "default": null,
          "notnull": true
        },
        {
          "name": "captured_at",
          "type": "timestamp with time zone",
          "default": "now()",
          "notnull": true
        }
      ],
      "privileges": [
        "SELECT",
        "INSERT"
      ]
    },
    {
      "name": "patrimonial_assignments",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "default": "gen_random_uuid()",
          "notnull": true
        },
        {
          "name": "assignment_key",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "intent_id",
          "type": "uuid",
          "default": null,
          "notnull": true
        },
        {
          "name": "operator_id",
          "type": "uuid",
          "default": null,
          "notnull": true
        },
        {
          "name": "pool_id",
          "type": "uuid",
          "default": null,
          "notnull": false
        },
        {
          "name": "experiment_id",
          "type": "uuid",
          "default": null,
          "notnull": false
        },
        {
          "name": "assignment_method",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "quality_snapshot_id",
          "type": "uuid",
          "default": null,
          "notnull": false
        },
        {
          "name": "assigned_at",
          "type": "timestamp with time zone",
          "default": "now()",
          "notnull": true
        },
        {
          "name": "released_at",
          "type": "timestamp with time zone",
          "default": null,
          "notnull": false
        },
        {
          "name": "release_reason",
          "type": "text",
          "default": null,
          "notnull": false
        },
        {
          "name": "assigned_by_type",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "assigned_by_ref",
          "type": "text",
          "default": null,
          "notnull": false
        },
        {
          "name": "command_key",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "revision",
          "type": "integer",
          "default": "0",
          "notnull": true
        },
        {
          "name": "metadata",
          "type": "jsonb",
          "default": "''{}''::jsonb",
          "notnull": true
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "default": "now()",
          "notnull": true
        }
      ],
      "privileges": [
        "SELECT",
        "INSERT",
        "UPDATE"
      ]
    },
    {
      "name": "patrimonial_assignment_state",
      "columns": [
        {
          "name": "singleton",
          "type": "boolean",
          "default": "true",
          "notnull": true
        },
        {
          "name": "revision",
          "type": "bigint",
          "default": "0",
          "notnull": true
        }
      ],
      "privileges": [
        "SELECT",
        "INSERT",
        "UPDATE"
      ]
    },
    {
      "name": "patrimonial_assignment_cursors",
      "columns": [
        {
          "name": "scope",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "operator_id",
          "type": "uuid",
          "default": null,
          "notnull": true
        }
      ],
      "privileges": [
        "SELECT",
        "INSERT",
        "UPDATE"
      ]
    },
    {
      "name": "patrimonial_assignment_commands",
      "columns": [
        {
          "name": "command_key",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "payload_hash",
          "type": "text",
          "default": null,
          "notnull": true
        },
        {
          "name": "result",
          "type": "jsonb",
          "default": null,
          "notnull": true
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "default": null,
          "notnull": true
        }
      ],
      "privileges": [
        "SELECT",
        "INSERT"
      ]
    },
    {
      "name": "patrimonial_intents",
      "columns": [
        {
          "name": "current_operator_id",
          "type": "uuid",
          "default": null,
          "notnull": false
        },
        {
          "name": "operator_revision",
          "type": "integer",
          "default": "0",
          "notnull": true
        }
      ],
      "privileges": [
        "SELECT",
        "UPDATE"
      ]
    },
    {
      "name": "patrimonial_domain_events",
      "columns": [
        {
          "name": "intent_id",
          "type": "uuid",
          "default": null,
          "notnull": false
        },
        {
          "name": "experiment_id",
          "type": "uuid",
          "default": null,
          "notnull": false
        }
      ],
      "privileges": [
        "SELECT",
        "INSERT"
      ]
    }
  ],
  "functions": [
    {
      "signature": "patrimonial_assignment_camel(jsonb)",
      "result": "jsonb",
      "hashes": [
        "492f1ff9fe0668244546b4184cf2db45"
      ],
      "volatility": "i"
    },
    {
      "signature": "patrimonial_assignment_commit(jsonb,bigint)",
      "result": "jsonb",
      "hashes": [
        "f9169ada0e30a9f45d6ca83a814a3807"
      ],
      "volatility": "v"
    },
    {
      "signature": "patrimonial_assignment_context(text,jsonb,uuid)",
      "result": "jsonb",
      "hashes": [
        "a9ab386590739cf1ec9e8f0d54bfe5c8"
      ],
      "volatility": "v"
    },
    {
      "signature": "patrimonial_assignment_guard()",
      "result": "trigger",
      "hashes": [
        "0e3a4213c8ae1f6921614e956e476094"
      ],
      "volatility": "v"
    },
    {
      "signature": "patrimonial_assignment_immutable()",
      "result": "trigger",
      "hashes": [
        "d857224a0da521d704c64a3e65c09609"
      ],
      "volatility": "v"
    },
    {
      "signature": "patrimonial_assignment_projection()",
      "result": "trigger",
      "hashes": [
        "1f1a813e7f7faea977ae36d99db025c2"
      ],
      "volatility": "v"
    },
    {
      "signature": "patrimonial_assignment_snake(jsonb)",
      "result": "jsonb",
      "hashes": [
        "ab32d055f8a2fc7521b2e1b6240aa29e"
      ],
      "volatility": "i"
    },
    {
      "signature": "patrimonial_execute_command(jsonb)",
      "result": "jsonb",
      "hashes": [
        "c72433d74e77c02da8e00db1b0e0554d",
        "ea21fa048964591c69529ddf05d46a47"
      ],
      "volatility": "v"
    },
    {
      "signature": "patrimonial_execute_command_pre_assignments(jsonb)",
      "result": "jsonb",
      "hashes": [
        "de2f6996d20ce27f69651b9e6c03c848"
      ],
      "volatility": "v"
    }
  ],
  "constraints": [
    {
      "name": "patrimonial_assignment_commands_payload_hash_check",
      "relation": "patrimonial_assignment_commands",
      "definition": "CHECK ((payload_hash ~ ''^[0-9a-f]{64}$''::text))"
    },
    {
      "name": "patrimonial_assignment_commands_pkey",
      "relation": "patrimonial_assignment_commands",
      "definition": "PRIMARY KEY (command_key)"
    },
    {
      "name": "patrimonial_assignment_commands_result_check",
      "relation": "patrimonial_assignment_commands",
      "definition": "CHECK ((jsonb_typeof(result) = ''object''::text))"
    },
    {
      "name": "patrimonial_assignment_cursors_operator_id_fkey",
      "relation": "patrimonial_assignment_cursors",
      "definition": "FOREIGN KEY (operator_id) REFERENCES patrimonial_operators(id)"
    },
    {
      "name": "patrimonial_assignment_cursors_pkey",
      "relation": "patrimonial_assignment_cursors",
      "definition": "PRIMARY KEY (scope)"
    },
    {
      "name": "patrimonial_assignment_experiment_operators_experiment_id_fkey",
      "relation": "patrimonial_assignment_experiment_operators",
      "definition": "FOREIGN KEY (experiment_id) REFERENCES patrimonial_assignment_experiments(id)"
    },
    {
      "name": "patrimonial_assignment_experiment_operators_operator_id_fkey",
      "relation": "patrimonial_assignment_experiment_operators",
      "definition": "FOREIGN KEY (operator_id) REFERENCES patrimonial_operators(id)"
    },
    {
      "name": "patrimonial_assignment_experiment_operators_pkey",
      "relation": "patrimonial_assignment_experiment_operators",
      "definition": "PRIMARY KEY (experiment_id, operator_id)"
    },
    {
      "name": "patrimonial_assignment_experiments_assignment_method_check",
      "relation": "patrimonial_assignment_experiments",
      "definition": "CHECK ((assignment_method = ANY (ARRAY[''MANUAL''::text, ''ROUND_ROBIN''::text, ''BALANCED_BATCH''::text])))"
    },
    {
      "name": "patrimonial_assignment_experiments_check",
      "relation": "patrimonial_assignment_experiments",
      "definition": "CHECK (((status = ''DRAFT''::text) OR (started_at IS NOT NULL)))"
    },
    {
      "name": "patrimonial_assignment_experiments_check1",
      "relation": "patrimonial_assignment_experiments",
      "definition": "CHECK (((status = ANY (ARRAY[''COMPLETED''::text, ''CANCELLED''::text])) = (ended_at IS NOT NULL)))"
    },
    {
      "name": "patrimonial_assignment_experiments_check2",
      "relation": "patrimonial_assignment_experiments",
      "definition": "CHECK (((ended_at IS NULL) OR (ended_at >= started_at)))"
    },
    {
      "name": "patrimonial_assignment_experiments_configuration_check",
      "relation": "patrimonial_assignment_experiments",
      "definition": "CHECK ((jsonb_typeof(configuration) = ''object''::text))"
    },
    {
      "name": "patrimonial_assignment_experiments_experiment_key_key",
      "relation": "patrimonial_assignment_experiments",
      "definition": "UNIQUE (experiment_key)"
    },
    {
      "name": "patrimonial_assignment_experiments_pkey",
      "relation": "patrimonial_assignment_experiments",
      "definition": "PRIMARY KEY (id)"
    },
    {
      "name": "patrimonial_assignment_experiments_pool_id_fkey",
      "relation": "patrimonial_assignment_experiments",
      "definition": "FOREIGN KEY (pool_id) REFERENCES patrimonial_operator_pools(id)"
    },
    {
      "name": "patrimonial_assignment_experiments_revision_check",
      "relation": "patrimonial_assignment_experiments",
      "definition": "CHECK ((revision >= 0))"
    },
    {
      "name": "patrimonial_assignment_experiments_status_check",
      "relation": "patrimonial_assignment_experiments",
      "definition": "CHECK ((status = ANY (ARRAY[''DRAFT''::text, ''ACTIVE''::text, ''PAUSED''::text, ''COMPLETED''::text, ''CANCELLED''::text])))"
    },
    {
      "name": "patrimonial_assignment_experiments_target_per_operator_check",
      "relation": "patrimonial_assignment_experiments",
      "definition": "CHECK (((target_per_operator IS NULL) OR (target_per_operator > 0)))"
    },
    {
      "name": "patrimonial_assignment_projection_consistent",
      "relation": "patrimonial_assignments",
      "definition": "TRIGGER DEFERRABLE INITIALLY DEFERRED"
    },
    {
      "name": "patrimonial_assignment_state_pkey",
      "relation": "patrimonial_assignment_state",
      "definition": "PRIMARY KEY (singleton)"
    },
    {
      "name": "patrimonial_assignment_state_revision_check",
      "relation": "patrimonial_assignment_state",
      "definition": "CHECK ((revision >= 0))"
    },
    {
      "name": "patrimonial_assignment_state_singleton_check",
      "relation": "patrimonial_assignment_state",
      "definition": "CHECK (singleton)"
    },
    {
      "name": "patrimonial_assignments_assigned_by_type_check",
      "relation": "patrimonial_assignments",
      "definition": "CHECK ((assigned_by_type = ANY (ARRAY[''SYSTEM''::text, ''ADMIN''::text, ''WORKER''::text])))"
    },
    {
      "name": "patrimonial_assignments_assignment_key_key",
      "relation": "patrimonial_assignments",
      "definition": "UNIQUE (assignment_key)"
    },
    {
      "name": "patrimonial_assignments_assignment_method_check",
      "relation": "patrimonial_assignments",
      "definition": "CHECK ((assignment_method = ANY (ARRAY[''MANUAL''::text, ''ROUND_ROBIN''::text, ''BALANCED_BATCH''::text])))"
    },
    {
      "name": "patrimonial_assignments_check",
      "relation": "patrimonial_assignments",
      "definition": "CHECK (((released_at IS NULL) = (release_reason IS NULL)))"
    },
    {
      "name": "patrimonial_assignments_check1",
      "relation": "patrimonial_assignments",
      "definition": "CHECK (((released_at IS NULL) OR (released_at >= assigned_at)))"
    },
    {
      "name": "patrimonial_assignments_experiment_id_fkey",
      "relation": "patrimonial_assignments",
      "definition": "FOREIGN KEY (experiment_id) REFERENCES patrimonial_assignment_experiments(id)"
    },
    {
      "name": "patrimonial_assignments_intent_id_fkey",
      "relation": "patrimonial_assignments",
      "definition": "FOREIGN KEY (intent_id) REFERENCES patrimonial_intents(id)"
    },
    {
      "name": "patrimonial_assignments_metadata_check",
      "relation": "patrimonial_assignments",
      "definition": "CHECK ((jsonb_typeof(metadata) = ''object''::text))"
    },
    {
      "name": "patrimonial_assignments_operator_id_fkey",
      "relation": "patrimonial_assignments",
      "definition": "FOREIGN KEY (operator_id) REFERENCES patrimonial_operators(id)"
    },
    {
      "name": "patrimonial_assignments_pkey",
      "relation": "patrimonial_assignments",
      "definition": "PRIMARY KEY (id)"
    },
    {
      "name": "patrimonial_assignments_pool_id_fkey",
      "relation": "patrimonial_assignments",
      "definition": "FOREIGN KEY (pool_id) REFERENCES patrimonial_operator_pools(id)"
    },
    {
      "name": "patrimonial_assignments_quality_snapshot_id_fkey",
      "relation": "patrimonial_assignments",
      "definition": "FOREIGN KEY (quality_snapshot_id) REFERENCES patrimonial_lead_snapshots(id)"
    },
    {
      "name": "patrimonial_assignments_release_reason_check",
      "relation": "patrimonial_assignments",
      "definition": "CHECK ((release_reason = ANY (ARRAY[''REASSIGNED''::text, ''MANUAL_RELEASE''::text, ''INTENT_CLOSED''::text])))"
    },
    {
      "name": "patrimonial_assignments_revision_check",
      "relation": "patrimonial_assignments",
      "definition": "CHECK ((revision >= 0))"
    },
    {
      "name": "patrimonial_domain_events_experiment_id_fkey",
      "relation": "patrimonial_domain_events",
      "definition": "FOREIGN KEY (experiment_id) REFERENCES patrimonial_assignment_experiments(id)"
    },
    {
      "name": "patrimonial_event_aggregate_required",
      "relation": "patrimonial_domain_events",
      "definition": "CHECK ((((event_name = ANY (ARRAY[''assignment_experiment_created''::text, ''assignment_experiment_activated''::text, ''assignment_experiment_paused''::text, ''assignment_experiment_completed''::text])) AND (experiment_id IS NOT NULL) AND (intent_id IS NULL)) OR ((event_name <> ALL (ARRAY[''assignment_experiment_created''::text, ''assignment_experiment_activated''::text, ''assignment_experiment_paused''::text, ''assignment_experiment_completed''::text])) AND (intent_id IS NOT NULL))))"
    },
    {
      "name": "patrimonial_intent_operator_consistent",
      "relation": "patrimonial_intents",
      "definition": "TRIGGER DEFERRABLE INITIALLY DEFERRED"
    },
    {
      "name": "patrimonial_intents_current_operator_id_fkey",
      "relation": "patrimonial_intents",
      "definition": "FOREIGN KEY (current_operator_id) REFERENCES patrimonial_operators(id)"
    },
    {
      "name": "patrimonial_intents_operator_revision_check",
      "relation": "patrimonial_intents",
      "definition": "CHECK ((operator_revision >= 0))"
    },
    {
      "name": "patrimonial_lead_snapshots_attributes_check",
      "relation": "patrimonial_lead_snapshots",
      "definition": "CHECK ((attributes = ''{}''::jsonb))"
    },
    {
      "name": "patrimonial_lead_snapshots_check",
      "relation": "patrimonial_lead_snapshots",
      "definition": "CHECK (((maturity_level IS NULL) AND (consultation_requested IS NULL)))"
    },
    {
      "name": "patrimonial_lead_snapshots_funnel_check",
      "relation": "patrimonial_lead_snapshots",
      "definition": "CHECK ((funnel = ANY (ARRAY[''architect-path''::text, ''patrimonial-event''::text, ''patrimonial-consultation''::text])))"
    },
    {
      "name": "patrimonial_lead_snapshots_intent_id_fkey",
      "relation": "patrimonial_lead_snapshots",
      "definition": "FOREIGN KEY (intent_id) REFERENCES patrimonial_intents(id)"
    },
    {
      "name": "patrimonial_lead_snapshots_pkey",
      "relation": "patrimonial_lead_snapshots",
      "definition": "PRIMARY KEY (id)"
    },
    {
      "name": "patrimonial_lead_snapshots_request_id_fkey",
      "relation": "patrimonial_lead_snapshots",
      "definition": "FOREIGN KEY (request_id) REFERENCES patrimonial_requests(request_id)"
    },
    {
      "name": "patrimonial_lead_snapshots_schema_version_check",
      "relation": "patrimonial_lead_snapshots",
      "definition": "CHECK ((schema_version = 1))"
    },
    {
      "name": "patrimonial_lead_snapshots_snapshot_key_key",
      "relation": "patrimonial_lead_snapshots",
      "definition": "UNIQUE (snapshot_key)"
    },
    {
      "name": "patrimonial_operator_pool_members_check",
      "relation": "patrimonial_operator_pool_members",
      "definition": "CHECK ((active = (left_at IS NULL)))"
    },
    {
      "name": "patrimonial_operator_pool_members_check1",
      "relation": "patrimonial_operator_pool_members",
      "definition": "CHECK (((left_at IS NULL) OR (left_at >= joined_at)))"
    },
    {
      "name": "patrimonial_operator_pool_members_operator_id_fkey",
      "relation": "patrimonial_operator_pool_members",
      "definition": "FOREIGN KEY (operator_id) REFERENCES patrimonial_operators(id)"
    },
    {
      "name": "patrimonial_operator_pool_members_pkey",
      "relation": "patrimonial_operator_pool_members",
      "definition": "PRIMARY KEY (id)"
    },
    {
      "name": "patrimonial_operator_pool_members_pool_id_fkey",
      "relation": "patrimonial_operator_pool_members",
      "definition": "FOREIGN KEY (pool_id) REFERENCES patrimonial_operator_pools(id)"
    },
    {
      "name": "patrimonial_operator_pool_members_weight_check",
      "relation": "patrimonial_operator_pool_members",
      "definition": "CHECK (((weight IS NULL) OR (weight > (0)::numeric)))"
    },
    {
      "name": "patrimonial_operator_pools_assignment_policy_check",
      "relation": "patrimonial_operator_pools",
      "definition": "CHECK ((assignment_policy = ANY (ARRAY[''MANUAL''::text, ''ROUND_ROBIN''::text, ''BALANCED_BATCH''::text])))"
    },
    {
      "name": "patrimonial_operator_pools_metadata_check",
      "relation": "patrimonial_operator_pools",
      "definition": "CHECK ((jsonb_typeof(metadata) = ''object''::text))"
    },
    {
      "name": "patrimonial_operator_pools_pkey",
      "relation": "patrimonial_operator_pools",
      "definition": "PRIMARY KEY (id)"
    },
    {
      "name": "patrimonial_operator_pools_pool_key_key",
      "relation": "patrimonial_operator_pools",
      "definition": "UNIQUE (pool_key)"
    },
    {
      "name": "patrimonial_operator_pools_revision_check",
      "relation": "patrimonial_operator_pools",
      "definition": "CHECK ((revision >= 0))"
    },
    {
      "name": "patrimonial_operators_capacity_check",
      "relation": "patrimonial_operators",
      "definition": "CHECK (((capacity IS NULL) OR (capacity >= 0)))"
    },
    {
      "name": "patrimonial_operators_display_name_check",
      "relation": "patrimonial_operators",
      "definition": "CHECK (((length(btrim(display_name)) >= 1) AND (length(btrim(display_name)) <= 120)))"
    },
    {
      "name": "patrimonial_operators_metadata_check",
      "relation": "patrimonial_operators",
      "definition": "CHECK ((jsonb_typeof(metadata) = ''object''::text))"
    },
    {
      "name": "patrimonial_operators_operator_key_check",
      "relation": "patrimonial_operators",
      "definition": "CHECK ((operator_key ~ ''^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,159}$''::text))"
    },
    {
      "name": "patrimonial_operators_operator_key_key",
      "relation": "patrimonial_operators",
      "definition": "UNIQUE (operator_key)"
    },
    {
      "name": "patrimonial_operators_pkey",
      "relation": "patrimonial_operators",
      "definition": "PRIMARY KEY (id)"
    },
    {
      "name": "patrimonial_operators_revision_check",
      "relation": "patrimonial_operators",
      "definition": "CHECK ((revision >= 0))"
    }
  ],
  "indexes": [
    {
      "name": "patrimonial_assignment_active_intent",
      "definition": "CREATE UNIQUE INDEX patrimonial_assignment_active_intent ON public.patrimonial_assignments USING btree (intent_id) WHERE (released_at IS NULL)"
    },
    {
      "name": "patrimonial_assignment_commands_pkey",
      "definition": "CREATE UNIQUE INDEX patrimonial_assignment_commands_pkey ON public.patrimonial_assignment_commands USING btree (command_key)"
    },
    {
      "name": "patrimonial_assignment_cursors_operator",
      "definition": "CREATE INDEX patrimonial_assignment_cursors_operator ON public.patrimonial_assignment_cursors USING btree (operator_id)"
    },
    {
      "name": "patrimonial_assignment_cursors_pkey",
      "definition": "CREATE UNIQUE INDEX patrimonial_assignment_cursors_pkey ON public.patrimonial_assignment_cursors USING btree (scope)"
    },
    {
      "name": "patrimonial_assignment_experiment_operators_pkey",
      "definition": "CREATE UNIQUE INDEX patrimonial_assignment_experiment_operators_pkey ON public.patrimonial_assignment_experiment_operators USING btree (experiment_id, operator_id)"
    },
    {
      "name": "patrimonial_assignment_experiments_experiment_key_key",
      "definition": "CREATE UNIQUE INDEX patrimonial_assignment_experiments_experiment_key_key ON public.patrimonial_assignment_experiments USING btree (experiment_key)"
    },
    {
      "name": "patrimonial_assignment_experiments_pkey",
      "definition": "CREATE UNIQUE INDEX patrimonial_assignment_experiments_pkey ON public.patrimonial_assignment_experiments USING btree (id)"
    },
    {
      "name": "patrimonial_assignment_state_pkey",
      "definition": "CREATE UNIQUE INDEX patrimonial_assignment_state_pkey ON public.patrimonial_assignment_state USING btree (singleton)"
    },
    {
      "name": "patrimonial_assignments_assignment_key_key",
      "definition": "CREATE UNIQUE INDEX patrimonial_assignments_assignment_key_key ON public.patrimonial_assignments USING btree (assignment_key)"
    },
    {
      "name": "patrimonial_assignments_command",
      "definition": "CREATE INDEX patrimonial_assignments_command ON public.patrimonial_assignments USING btree (command_key)"
    },
    {
      "name": "patrimonial_assignments_experiment_operator",
      "definition": "CREATE INDEX patrimonial_assignments_experiment_operator ON public.patrimonial_assignments USING btree (experiment_id, operator_id)"
    },
    {
      "name": "patrimonial_assignments_operator_active",
      "definition": "CREATE INDEX patrimonial_assignments_operator_active ON public.patrimonial_assignments USING btree (operator_id) WHERE (released_at IS NULL)"
    },
    {
      "name": "patrimonial_assignments_pkey",
      "definition": "CREATE UNIQUE INDEX patrimonial_assignments_pkey ON public.patrimonial_assignments USING btree (id)"
    },
    {
      "name": "patrimonial_assignments_pool",
      "definition": "CREATE INDEX patrimonial_assignments_pool ON public.patrimonial_assignments USING btree (pool_id)"
    },
    {
      "name": "patrimonial_assignments_snapshot",
      "definition": "CREATE INDEX patrimonial_assignments_snapshot ON public.patrimonial_assignments USING btree (quality_snapshot_id)"
    },
    {
      "name": "patrimonial_domain_events_experiment",
      "definition": "CREATE INDEX patrimonial_domain_events_experiment ON public.patrimonial_domain_events USING btree (experiment_id) WHERE (experiment_id IS NOT NULL)"
    },
    {
      "name": "patrimonial_experiment_operators_operator",
      "definition": "CREATE INDEX patrimonial_experiment_operators_operator ON public.patrimonial_assignment_experiment_operators USING btree (operator_id)"
    },
    {
      "name": "patrimonial_experiments_pool",
      "definition": "CREATE INDEX patrimonial_experiments_pool ON public.patrimonial_assignment_experiments USING btree (pool_id)"
    },
    {
      "name": "patrimonial_intents_current_operator",
      "definition": "CREATE INDEX patrimonial_intents_current_operator ON public.patrimonial_intents USING btree (current_operator_id) WHERE (current_operator_id IS NOT NULL)"
    },
    {
      "name": "patrimonial_lead_snapshots_pkey",
      "definition": "CREATE UNIQUE INDEX patrimonial_lead_snapshots_pkey ON public.patrimonial_lead_snapshots USING btree (id)"
    },
    {
      "name": "patrimonial_lead_snapshots_snapshot_key_key",
      "definition": "CREATE UNIQUE INDEX patrimonial_lead_snapshots_snapshot_key_key ON public.patrimonial_lead_snapshots USING btree (snapshot_key)"
    },
    {
      "name": "patrimonial_operator_pool_members_pkey",
      "definition": "CREATE UNIQUE INDEX patrimonial_operator_pool_members_pkey ON public.patrimonial_operator_pool_members USING btree (id)"
    },
    {
      "name": "patrimonial_operator_pools_pkey",
      "definition": "CREATE UNIQUE INDEX patrimonial_operator_pools_pkey ON public.patrimonial_operator_pools USING btree (id)"
    },
    {
      "name": "patrimonial_operator_pools_pool_key_key",
      "definition": "CREATE UNIQUE INDEX patrimonial_operator_pools_pool_key_key ON public.patrimonial_operator_pools USING btree (pool_key)"
    },
    {
      "name": "patrimonial_operators_operator_key_key",
      "definition": "CREATE UNIQUE INDEX patrimonial_operators_operator_key_key ON public.patrimonial_operators USING btree (operator_key)"
    },
    {
      "name": "patrimonial_operators_pkey",
      "definition": "CREATE UNIQUE INDEX patrimonial_operators_pkey ON public.patrimonial_operators USING btree (id)"
    },
    {
      "name": "patrimonial_pool_member_active",
      "definition": "CREATE UNIQUE INDEX patrimonial_pool_member_active ON public.patrimonial_operator_pool_members USING btree (pool_id, operator_id) WHERE active"
    },
    {
      "name": "patrimonial_pool_members_operator",
      "definition": "CREATE INDEX patrimonial_pool_members_operator ON public.patrimonial_operator_pool_members USING btree (operator_id)"
    },
    {
      "name": "patrimonial_snapshots_intent",
      "definition": "CREATE INDEX patrimonial_snapshots_intent ON public.patrimonial_lead_snapshots USING btree (intent_id)"
    },
    {
      "name": "patrimonial_snapshots_request",
      "definition": "CREATE INDEX patrimonial_snapshots_request ON public.patrimonial_lead_snapshots USING btree (request_id)"
    }
  ],
  "triggers": [
    {
      "name": "patrimonial_assignment_command_immutable",
      "relation": "patrimonial_assignment_commands",
      "definition": "CREATE TRIGGER patrimonial_assignment_command_immutable BEFORE DELETE OR UPDATE ON public.patrimonial_assignment_commands FOR EACH ROW EXECUTE FUNCTION patrimonial_assignment_immutable()"
    },
    {
      "name": "patrimonial_assignment_history_guard",
      "relation": "patrimonial_assignments",
      "definition": "CREATE TRIGGER patrimonial_assignment_history_guard BEFORE INSERT OR UPDATE ON public.patrimonial_assignments FOR EACH ROW EXECUTE FUNCTION patrimonial_assignment_guard()"
    },
    {
      "name": "patrimonial_assignment_no_delete",
      "relation": "patrimonial_assignments",
      "definition": "CREATE TRIGGER patrimonial_assignment_no_delete BEFORE DELETE ON public.patrimonial_assignments FOR EACH ROW EXECUTE FUNCTION patrimonial_assignment_immutable()"
    },
    {
      "name": "patrimonial_assignment_projection_consistent",
      "relation": "patrimonial_assignments",
      "definition": "CREATE CONSTRAINT TRIGGER patrimonial_assignment_projection_consistent AFTER INSERT OR UPDATE ON public.patrimonial_assignments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION patrimonial_assignment_projection()"
    },
    {
      "name": "patrimonial_experiment_members_frozen",
      "relation": "patrimonial_assignment_experiment_operators",
      "definition": "CREATE TRIGGER patrimonial_experiment_members_frozen BEFORE INSERT OR DELETE OR UPDATE ON public.patrimonial_assignment_experiment_operators FOR EACH ROW EXECUTE FUNCTION patrimonial_assignment_guard()"
    },
    {
      "name": "patrimonial_experiment_stable",
      "relation": "patrimonial_assignment_experiments",
      "definition": "CREATE TRIGGER patrimonial_experiment_stable BEFORE UPDATE ON public.patrimonial_assignment_experiments FOR EACH ROW EXECUTE FUNCTION patrimonial_assignment_guard()"
    },
    {
      "name": "patrimonial_intent_operator_consistent",
      "relation": "patrimonial_intents",
      "definition": "CREATE CONSTRAINT TRIGGER patrimonial_intent_operator_consistent AFTER INSERT OR UPDATE OF current_operator_id ON public.patrimonial_intents DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION patrimonial_assignment_projection()"
    },
    {
      "name": "patrimonial_operator_no_delete",
      "relation": "patrimonial_operators",
      "definition": "CREATE TRIGGER patrimonial_operator_no_delete BEFORE DELETE ON public.patrimonial_operators FOR EACH ROW EXECUTE FUNCTION patrimonial_assignment_immutable()"
    },
    {
      "name": "patrimonial_operator_stable",
      "relation": "patrimonial_operators",
      "definition": "CREATE TRIGGER patrimonial_operator_stable BEFORE UPDATE ON public.patrimonial_operators FOR EACH ROW EXECUTE FUNCTION patrimonial_assignment_guard()"
    },
    {
      "name": "patrimonial_snapshot_immutable",
      "relation": "patrimonial_lead_snapshots",
      "definition": "CREATE TRIGGER patrimonial_snapshot_immutable BEFORE DELETE OR UPDATE ON public.patrimonial_lead_snapshots FOR EACH ROW EXECUTE FUNCTION patrimonial_assignment_immutable()"
    }
  ]
}'::jsonb);
  owner_ok:=assignment_ok and public.patrimonial_capability_objects('{
  "tables": [
    {
      "name": "patrimonial_intents",
      "columns": [
        {
          "name": "owner_checkpoint_revision",
          "type": "integer",
          "default": "0",
          "notnull": true
        },
        {
          "name": "owner_checkpoint",
          "type": "jsonb",
          "default": null,
          "notnull": false
        }
      ],
      "privileges": [
        "SELECT",
        "UPDATE"
      ]
    }
  ],
  "functions": [
    {
      "signature": "claim_patrimonial_operations(jsonb,jsonb)",
      "result": "jsonb",
      "hashes": [
        "8ade91861701e6656500f4c653d7fbd7"
      ],
      "volatility": "v"
    },
    {
      "signature": "patrimonial_execute_command(jsonb)",
      "result": "jsonb",
      "hashes": [
        "ea21fa048964591c69529ddf05d46a47"
      ],
      "volatility": "v"
    },
    {
      "signature": "patrimonial_execute_command_pre_owner_sync(jsonb)",
      "result": "jsonb",
      "hashes": [
        "c72433d74e77c02da8e00db1b0e0554d"
      ],
      "volatility": "v"
    },
    {
      "signature": "patrimonial_owner_context(jsonb)",
      "result": "jsonb",
      "hashes": [
        "f72a0dac4897a5ee7475401cc07f898b"
      ],
      "volatility": "v"
    },
    {
      "signature": "patrimonial_owner_enqueue(jsonb)",
      "result": "void",
      "hashes": [
        "8cd555f0fb64cde68ce4ba5145f471ac"
      ],
      "volatility": "v"
    },
    {
      "signature": "patrimonial_owner_event(jsonb,text)",
      "result": "void",
      "hashes": [
        "ac86968f0db91a0eff8cb6560cc33f73"
      ],
      "volatility": "v"
    },
    {
      "signature": "patrimonial_owner_finish(jsonb)",
      "result": "jsonb",
      "hashes": [
        "7c4dd2b7d1aeb10eda808c99d6a3169d"
      ],
      "volatility": "v"
    }
  ],
  "constraints": [
    {
      "name": "patrimonial_intents_owner_checkpoint_check",
      "relation": "patrimonial_intents",
      "definition": "CHECK (((owner_checkpoint IS NULL) OR (jsonb_typeof(owner_checkpoint) = ''object''::text)))"
    },
    {
      "name": "patrimonial_intents_owner_checkpoint_revision_check",
      "relation": "patrimonial_intents",
      "definition": "CHECK ((owner_checkpoint_revision >= 0))"
    },
    {
      "name": "patrimonial_outbox_operations_effect_type_check",
      "relation": "patrimonial_outbox_operations",
      "definition": "CHECK ((effect_type = ANY (ARRAY[''SYNC_REQUEST''::text, ''RESOLVE_CONTACT''::text, ''UPSERT_CONTACT''::text, ''ADD_TAGS''::text, ''ADD_NOTE''::text, ''ASSIGN_OPPORTUNITY_OWNER''::text])))"
    }
  ],
  "indexes": [
    {
      "name": "patrimonial_owner_outbox",
      "definition": "CREATE INDEX patrimonial_owner_outbox ON public.patrimonial_outbox_operations USING btree (intent_id, status, next_attempt_at) WHERE (effect_type = ''ASSIGN_OPPORTUNITY_OWNER''::text)"
    }
  ],
  "triggers": []
}'::jsonb);
  return jsonb_build_object('contract','patrimonial-runtime-capabilities-v1','base',case when base_ok then 'patrimonial-v2-store-1' end,'assignmentManagement',case when assignment_ok then 'p1-v1' end,'ownerSync',case when owner_ok then 'p2b-v1' end);
end $$;
revoke all on function public.patrimonial_capability_objects(jsonb),public.patrimonial_store_capabilities() from public,anon,authenticated,service_role;
grant execute on function public.patrimonial_capability_objects(jsonb),public.patrimonial_store_capabilities() to service_role;
commit;
