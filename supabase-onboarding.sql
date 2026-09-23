-- PLANNER DE CASAMENTO — ONBOARDING AUTOMÁTICO
-- Execute no SQL Editor do NOVO projeto depois da base inicial.
-- Este ajuste faz o cadastro público criar automaticamente o casamento do usuário.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  couple_name_value text;
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name',''),
      split_part(coalesce(new.email,''), '@', 1)
    ),
    new.email,
    'client'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  couple_name_value := coalesce(
    nullif(new.raw_user_meta_data ->> 'couple_name',''),
    nullif(new.raw_user_meta_data ->> 'partner1_name',''),
    'Meu casamento'
  );

  insert into public.weddings (
    client_user_id,
    couple_name,
    partner1_name,
    partner2_name,
    wedding_date,
    venue,
    guests,
    budget
  )
  values (
    new.id,
    couple_name_value,
    nullif(new.raw_user_meta_data ->> 'partner1_name',''),
    nullif(new.raw_user_meta_data ->> 'partner2_name',''),
    case
      when coalesce(new.raw_user_meta_data ->> 'wedding_date','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}
      then (new.raw_user_meta_data ->> 'wedding_date')::date
      else null
    end,
    nullif(new.raw_user_meta_data ->> 'venue',''),
    case
      when coalesce(new.raw_user_meta_data ->> 'guests','') ~ '^[0-9]+
      then greatest((new.raw_user_meta_data ->> 'guests')::integer,0)
      else 0
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'budget','') ~ '^[0-9]+([.][0-9]+)?
      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then (new.raw_user_meta_data ->> 'wedding_date')::date
      else null
    end,
    nullif(new.raw_user_meta_data ->> 'venue',''),
    case
      when coalesce(new.raw_user_meta_data ->> 'guests','') ~ '^\\d+$'
      then greatest((new.raw_user_meta_data ->> 'guests')::integer,0)
      else 0
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'budget','') ~ '^\\d+(\\.\\d+)?$'
      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then (new.raw_user_meta_data ->> 'wedding_date')::date
      else null
    end,
    nullif(new.raw_user_meta_data ->> 'venue',''),
    case
      when coalesce(new.raw_user_meta_data ->> 'guests','') ~ '^\\d+$'
      then greatest((new.raw_user_meta_data ->> 'guests')::integer,0)
      else 0
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'budget','') ~ '^[0-9]+([.][0-9]+)?
      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then greatest((new.raw_user_meta_data ->> 'guests')::integer,0)
      else 0
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'budget','') ~ '^[0-9]+([.][0-9]+)?
      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then (new.raw_user_meta_data ->> 'wedding_date')::date
      else null
    end,
    nullif(new.raw_user_meta_data ->> 'venue',''),
    case
      when coalesce(new.raw_user_meta_data ->> 'guests','') ~ '^[0-9]+
      then greatest((new.raw_user_meta_data ->> 'guests')::integer,0)
      else 0
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'budget','') ~ '^\\d+(\\.\\d+)?$'
      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then (new.raw_user_meta_data ->> 'wedding_date')::date
      else null
    end,
    nullif(new.raw_user_meta_data ->> 'venue',''),
    case
      when coalesce(new.raw_user_meta_data ->> 'guests','') ~ '^\\d+$'
      then greatest((new.raw_user_meta_data ->> 'guests')::integer,0)
      else 0
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'budget','') ~ '^[0-9]+([.][0-9]+)?
      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then greatest((new.raw_user_meta_data ->> 'guests')::integer,0)
      else 0
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'budget','') ~ '^\\d+(\\.\\d+)?$'
      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then (new.raw_user_meta_data ->> 'wedding_date')::date
      else null
    end,
    nullif(new.raw_user_meta_data ->> 'venue',''),
    case
      when coalesce(new.raw_user_meta_data ->> 'guests','') ~ '^[0-9]+
      then greatest((new.raw_user_meta_data ->> 'guests')::integer,0)
      else 0
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'budget','') ~ '^[0-9]+([.][0-9]+)?
      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then greatest((new.raw_user_meta_data ->> 'guests')::integer,0)
      else 0
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'budget','') ~ '^[0-9]+([.][0-9]+)?
      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.

      then greatest((new.raw_user_meta_data ->> 'budget')::numeric,0)
      else 0
    end
  )
  on conflict (client_user_id) do nothing;

  return new;
end;
$$;

-- O trigger criado na base inicial já aponta para handle_new_user(),
-- então não é necessário recriá-lo.
