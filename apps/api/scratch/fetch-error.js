async function testRefresh() {
  const cookie = 'school_os_refresh_token=a157124492f21f7ef9cec1bb31822103e885b88e36fc355cdb79cd9f3e69953bb1ce408ce2725981d611f01dc85bcd92';
  
  try {
    const response = await fetch('http://localhost:4000/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({})
    });
    
    console.log('Status:', response.status);
    const body = await response.json();
    console.log('Body:', JSON.stringify(body, null, 2));
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testRefresh();
