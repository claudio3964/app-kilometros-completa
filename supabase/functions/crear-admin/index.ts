import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const { email, password, nombre, rol } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
    }

    const { data: admin } = await supabase
      .from('admins')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (admin?.rol !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'Solo superadmin puede crear admins' }), { status: 403 })
    }

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre }
    })

    if (createError) throw createError

    await supabase.from('admins').insert({
      id: newUser.user.id,
      empresa_id: 'cot',
      nombre,
      email,
      rol,
      activo: true,
      created_by: user.id
    })

    return new Response(JSON.stringify({
      id: newUser.user.id,
      email,
      rol
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
